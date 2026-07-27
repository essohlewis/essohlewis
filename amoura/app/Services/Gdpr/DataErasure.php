<?php
declare(strict_types=1);

namespace Amoura\Services\Gdpr;

use Amoura\Core\Database;
use Amoura\Core\Storage\StorageManager;
use Amoura\Services\Logger;

/**
 * Droit à l'effacement (RGPD art. 17) — Phase 4, Sprint +9.
 *
 * Anonymise le compte et purge les données personnelles de façon atomique,
 * tout en préservant :
 *   - l'intégrité référentielle (la ligne users est anonymisée, pas supprimée) ;
 *   - les registres financiers (transactions) requis par la loi comptable,
 *     désormais dépourvus de PII puisque le compte est anonymisé.
 */
final class DataErasure
{
    /**
     * Efface les données personnelles de l'utilisateur.
     * @return array<string,int> nombre de lignes affectées par catégorie
     */
    public static function erase(int $userId): array
    {
        // Fichiers médias hors transaction (best-effort, système de fichiers).
        self::deletePhotoFiles($userId);

        $db = Database::connection();
        $affected = [];

        $db->beginTransaction();
        try {
            $exec = function (string $sql, array $params = []) use ($db): int {
                $st = $db->prepare($sql);
                $st->execute($params);
                return $st->rowCount();
            };

            // 1) Anonymise le compte (conserve la ligne pour l'intégrité des FK).
            $exec(
                "UPDATE users SET
                    email = NULL, phone = NULL, display_name = 'Compte supprimé',
                    password_hash = ?, totp_secret = NULL, totp_enabled = 0,
                    birthdate = NULL, is_online = 0, is_verified = 0,
                    status = 'deleted', deleted_at = NOW()
                 WHERE id = ?",
                [bin2hex(random_bytes(32)), $userId]     // mot de passe irrécupérable
            );

            // 2) Efface les données de profil (PII).
            $affected['profile'] = $exec(
                "UPDATE profiles SET bio = NULL, city = NULL, country = NULL,
                    latitude = NULL, longitude = NULL, job_title = NULL, education = NULL,
                    interests = NULL, languages = NULL
                 WHERE user_id = ?",
                [$userId]
            );

            // 3) Anonymise le contenu des messages émis (données partagées → neutralisées).
            $affected['messages'] = $exec(
                "UPDATE messages SET body = NULL, media_path = NULL, media_meta = NULL
                 WHERE sender_id = ?",
                [$userId]
            );

            // 4) Supprime les données strictement personnelles et techniques.
            $affected['photos'] = $exec('DELETE FROM photos WHERE user_id = ?', [$userId]);
            $affected['auth_tokens'] = $exec('DELETE FROM auth_tokens WHERE user_id = ?', [$userId]);
            $affected['sessions'] = $exec('DELETE FROM sessions WHERE user_id = ?', [$userId]);
            $affected['login_devices'] = $exec('DELETE FROM login_devices WHERE user_id = ?', [$userId]);
            $affected['push_subscriptions'] = $exec('DELETE FROM push_subscriptions WHERE user_id = ?', [$userId]);
            $affected['swipes'] = $exec('DELETE FROM swipes WHERE actor_id = ?', [$userId]);
            $affected['profile_views'] = $exec('DELETE FROM profile_views WHERE viewer_id = ?', [$userId]);
            $affected['notifications'] = $exec('DELETE FROM notifications WHERE user_id = ?', [$userId]);
            $affected['privacy_settings'] = $exec('DELETE FROM privacy_settings WHERE user_id = ?', [$userId]);
            $affected['blocks'] = $exec('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [$userId, $userId]);

            // 5) Journalise l'effacement (preuve du traitement de la demande).
            $exec(
                "INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES (?, 'gdpr.erased', 'user', ?)",
                [$userId, $userId]
            );

            $db->commit();
            Logger::info('gdpr.erasure', ['user_id' => $userId] + $affected);
            return $affected;
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Logger::error('gdpr.erasure_failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    /** Supprime les fichiers image de l'utilisateur du stockage (best-effort). */
    private static function deletePhotoFiles(int $userId): void
    {
        try {
            $st = Database::read()->prepare('SELECT path, thumb_path FROM photos WHERE user_id = ?');
            $st->execute([$userId]);
            $disk = StorageManager::disk();
            foreach ($st->fetchAll() as $row) {
                foreach ([$row['path'] ?? null, $row['thumb_path'] ?? null] as $path) {
                    if (is_string($path) && $path !== '') {
                        $disk->delete($path);
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ne bloque pas l'effacement des données si un fichier manque.
            Logger::error('gdpr.photo_cleanup_failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
        }
    }
}

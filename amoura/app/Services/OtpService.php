<?php
declare(strict_types=1);

namespace Amoura\Services;

use Amoura\Core\Database;

/**
 * Génération et vérification de codes OTP (email/téléphone).
 * Le code n'est jamais stocké en clair : seul son hash est conservé.
 */
final class OtpService
{
    private const TTL_SECONDS = 600;   // 10 minutes
    private const MAX_ATTEMPTS = 5;

    /**
     * Émet un OTP à 6 chiffres, le persiste (haché) et renvoie le code en clair
     * (à transmettre par email/SMS — jamais loggé en production).
     */
    public static function issue(?int $userId, string $channel, string $purpose, string $destination): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hash = password_hash($code, PASSWORD_DEFAULT);

        $db = Database::connection();
        // Invalide les OTP précédents non consommés pour la même cible/objet.
        $db->prepare(
            'UPDATE auth_tokens SET consumed_at = NOW()
             WHERE destination = ? AND purpose = ? AND consumed_at IS NULL'
        )->execute([$destination, $purpose]);

        $db->prepare(
            'INSERT INTO auth_tokens (user_id, channel, purpose, destination, code_hash, expires_at)
             VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        )->execute([$userId, $channel, $purpose, $destination, $hash, self::TTL_SECONDS]);

        return $code;
    }

    /**
     * Vérifie un OTP. Consomme le jeton en cas de succès.
     * @return array{ok:bool, user_id:?int, error:?string}
     */
    public static function verify(string $destination, string $purpose, string $code): array
    {
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'SELECT * FROM auth_tokens
                 WHERE destination = ? AND purpose = ? AND consumed_at IS NULL
                 ORDER BY id DESC LIMIT 1 FOR UPDATE'
            );
            $stmt->execute([$destination, $purpose]);
            $token = $stmt->fetch();

            if (!$token) {
                $db->commit();
                return ['ok' => false, 'user_id' => null, 'error' => 'Code introuvable ou déjà utilisé.'];
            }
            if (strtotime($token['expires_at']) < time()) {
                $db->commit();
                return ['ok' => false, 'user_id' => null, 'error' => 'Code expiré.'];
            }
            if ((int) $token['attempts'] >= self::MAX_ATTEMPTS) {
                $db->prepare('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = ?')->execute([$token['id']]);
                $db->commit();
                return ['ok' => false, 'user_id' => null, 'error' => 'Trop de tentatives. Redemandez un code.'];
            }

            if (!password_verify($code, $token['code_hash'])) {
                $db->prepare('UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = ?')->execute([$token['id']]);
                $db->commit();
                return ['ok' => false, 'user_id' => null, 'error' => 'Code incorrect.'];
            }

            $db->prepare('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = ?')->execute([$token['id']]);
            $db->commit();
            return ['ok' => true, 'user_id' => $token['user_id'] !== null ? (int) $token['user_id'] : null, 'error' => null];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            return ['ok' => false, 'user_id' => null, 'error' => 'Erreur de vérification.'];
        }
    }
}

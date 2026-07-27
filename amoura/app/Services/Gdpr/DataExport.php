<?php
declare(strict_types=1);

namespace Amoura\Services\Gdpr;

use Amoura\Core\Database;
use Amoura\Core\Security\Crypto;
use Amoura\Models\Consent;

/**
 * Export des données personnelles (RGPD art. 15 & 20 — accès & portabilité).
 * Rassemble, en lecture seule, toutes les données d'un utilisateur dans une
 * structure exploitable (JSON). N'inclut jamais de secret (hash, secret TOTP)
 * ni les données personnelles d'autrui.
 */
final class DataExport
{
    public static function forUser(int $userId): array
    {
        $db = Database::read();

        $fetchAll = function (string $sql) use ($db, $userId): array {
            $st = $db->prepare($sql);
            $st->execute([$userId]);
            return $st->fetchAll();
        };
        $fetchOne = function (string $sql) use ($db, $userId): ?array {
            $st = $db->prepare($sql);
            $st->execute([$userId]);
            $row = $st->fetch();
            return $row ?: null;
        };

        // Compte (sans secrets).
        $account = $fetchOne('SELECT id, email, phone, display_name, birthdate, gender, status,
                                     email_verified_at, phone_verified_at, is_verified,
                                     gdpr_consent_at, created_at
                              FROM users WHERE id = ?');

        // Messages émis par l'utilisateur (déchiffrés pour la portabilité).
        $messages = $fetchAll('SELECT id, conversation_id, type, body, created_at
                               FROM messages WHERE sender_id = ? ORDER BY id ASC');
        foreach ($messages as &$m) {
            if (!empty($m['body'])) {
                $m['body'] = Crypto::decrypt((string) $m['body']);
            }
        }
        unset($m);

        return [
            'export_meta' => [
                'generated_at' => date('c'),
                'format' => 'json',
                'notice' => 'Export RGPD (accès & portabilité). Ne contient aucune donnée d\'un autre utilisateur.',
            ],
            'account' => $account,
            'profile' => $fetchOne('SELECT * FROM profiles WHERE user_id = ?'),
            'privacy_settings' => $fetchOne('SELECT * FROM privacy_settings WHERE user_id = ?'),
            'photos' => $fetchAll('SELECT id, path, is_primary, moderation, created_at FROM photos WHERE user_id = ?'),
            'consents' => (new Consent())->history($userId),
            'swipes' => $fetchAll('SELECT target_id, action, created_at FROM swipes WHERE actor_id = ? ORDER BY id ASC'),
            'matches' => $fetchAll('SELECT id, user_lo, user_hi, status, matched_at FROM matches
                                    WHERE ? IN (user_lo, user_hi) ORDER BY id ASC'),
            'messages_sent' => $messages,
            'subscriptions' => $fetchAll('SELECT id, plan_id, status, started_at, current_period_end, canceled_at, created_at
                                          FROM subscriptions WHERE user_id = ? ORDER BY id ASC'),
            'transactions' => $fetchAll('SELECT id, plan_id, product_id, gateway, amount_cents, currency, status, paid_at, created_at
                                         FROM transactions WHERE user_id = ? ORDER BY id ASC'),
            'credits' => $fetchAll('SELECT item, balance, updated_at FROM user_credits WHERE user_id = ?'),
            'login_devices' => $fetchAll('SELECT user_agent, INET6_NTOA(last_ip) AS last_ip, first_seen_at, last_seen_at
                                          FROM login_devices WHERE user_id = ?'),
            'blocks_made' => $fetchAll('SELECT blocked_id, created_at FROM blocks WHERE blocker_id = ?'),
            'notifications' => $fetchAll('SELECT type, data, created_at FROM notifications WHERE user_id = ? ORDER BY id ASC'),
            'activity_log' => $fetchAll('SELECT action, entity_type, entity_id, created_at FROM activity_logs WHERE user_id = ? ORDER BY id ASC'),
        ];
    }

    /** Sérialise l'export en JSON lisible. */
    public static function toJson(int $userId): string
    {
        return (string) json_encode(self::forUser($userId), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Consentements RGPD granulaires (Phase 4, Sprint +9).
 * Journal append-only : chaque octroi/retrait est une nouvelle ligne. L'état
 * courant d'une finalité est celui de la dernière ligne (id le plus élevé).
 */
final class Consent extends Model
{
    protected string $table = 'user_consents';

    /** Finalités reconnues (les deux premières sont obligatoires à l'inscription). */
    public const PURPOSES = ['privacy_policy', 'terms', 'marketing', 'analytics'];

    /** Enregistre un consentement (ou son retrait) et renvoie l'id de la ligne. */
    public function record(int $userId, string $purpose, bool $granted, ?string $version = null, ?string $ip = null): int
    {
        $packedIp = $ip !== null ? (@inet_pton($ip) ?: null) : null;
        $this->run(
            'INSERT INTO user_consents (user_id, purpose, granted, version, ip) VALUES (?, ?, ?, ?, ?)',
            [$userId, $purpose, $granted ? 1 : 0, $version, $packedIp]
        );
        return (int) $this->db->lastInsertId();
    }

    /** État courant de chaque finalité pour un utilisateur : [purpose => bool]. */
    public function current(int $userId): array
    {
        // Dernière décision par finalité (sous-requête sur l'id max).
        $rows = $this->run(
            'SELECT c.purpose, c.granted
             FROM user_consents c
             JOIN (SELECT purpose, MAX(id) AS max_id FROM user_consents WHERE user_id = ? GROUP BY purpose) latest
               ON latest.max_id = c.id',
            [$userId]
        )->fetchAll();

        $state = [];
        foreach ($rows as $r) {
            $state[$r['purpose']] = (bool) $r['granted'];
        }
        return $state;
    }

    /** Vrai si la finalité est actuellement consentie. */
    public function has(int $userId, string $purpose): bool
    {
        return (bool) ($this->current($userId)[$purpose] ?? false);
    }

    /** Historique complet (pour l'export RGPD et l'audit). */
    public function history(int $userId): array
    {
        $rows = $this->run(
            'SELECT purpose, granted, version, INET6_NTOA(ip) AS ip, created_at
             FROM user_consents WHERE user_id = ? ORDER BY id ASC',
            [$userId]
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['granted'] = (bool) $r['granted'];
        }
        return $rows;
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Requêtes de découverte et gestion des matchs.
 * (« Matching » plutôt que « Match » car match est un mot-clé réservé PHP 8.)
 */
final class Matching extends Model
{
    protected string $table = 'matches';

    /**
     * Fil de découverte : profils candidats selon filtres et préférences.
     * Exclut : soi-même, profils déjà swipés, comptes bloqués/inactifs, non-découvrables.
     *
     * @param array $filters min_age,max_age,gender,country,city,distance_km,interests[]
     */
    public function discover(int $userId, array $filters = [], int $limit = 20): array
    {
        $params = [$userId, $userId, $userId, $userId];
        $where = [
            'u.id <> ?',                                   // pas soi-même
            'u.status = "active"',
            // découvrable (privacy_settings) ; absence de ligne = découvrable par défaut
            '(pv.discoverable = 1 OR pv.discoverable IS NULL)',
            // pas déjà swipé
            'NOT EXISTS (SELECT 1 FROM swipes s WHERE s.actor_id = ? AND s.target_id = u.id)',
            // pas de blocage dans un sens ou l'autre
            'NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))',
        ];

        if (!empty($filters['gender'])) {
            $where[] = 'u.gender = ?';
            $params[] = $filters['gender'];
        }
        if (!empty($filters['country'])) {
            $where[] = 'p.country = ?';
            $params[] = $filters['country'];
        }
        if (!empty($filters['city'])) {
            $where[] = 'p.city = ?';
            $params[] = $filters['city'];
        }
        if (!empty($filters['min_age'])) {
            $where[] = 'u.birthdate <= DATE_SUB(CURDATE(), INTERVAL ? YEAR)';
            $params[] = (int) $filters['min_age'];
        }
        if (!empty($filters['max_age'])) {
            $where[] = 'u.birthdate >= DATE_SUB(CURDATE(), INTERVAL ? YEAR)';
            $params[] = (int) $filters['max_age'];
        }

        // Distance géographique approximative (formule de Haversine) si coordonnées fournies.
        $distanceSelect = 'NULL AS distance_km';
        $having = '';
        if (isset($filters['lat'], $filters['lng']) && is_numeric($filters['lat']) && is_numeric($filters['lng'])) {
            $distanceSelect =
                '(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(p.latitude)) *
                  COS(RADIANS(p.longitude) - RADIANS(?)) +
                  SIN(RADIANS(?)) * SIN(RADIANS(p.latitude))))) AS distance_km';
            // Ces 3 paramètres viennent en tête du SELECT — on les préfixe.
            array_unshift($params, (float) $filters['lat'], (float) $filters['lng'], (float) $filters['lat']);
            if (!empty($filters['distance_km'])) {
                $having = 'HAVING distance_km IS NULL OR distance_km <= ' . (int) $filters['distance_km'];
            }
        }

        $sql =
            "SELECT u.id, u.display_name, u.birthdate, u.gender, u.is_verified, u.is_online, u.last_active_at,
                    p.bio, p.city, p.country, p.interests, p.job_title,
                    ph.path AS avatar_path,
                    {$distanceSelect}
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             LEFT JOIN privacy_settings pv ON pv.user_id = u.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE " . implode(' AND ', $where) . "
             {$having}
             ORDER BY u.is_online DESC, u.last_active_at DESC
             LIMIT ?";
        $params[] = $limit;

        return $this->run($sql, $params)->fetchAll();
    }

    /** Liste des matchs actifs d'un utilisateur, avec l'autre membre et le dernier message. */
    public function forUser(int $userId): array
    {
        return $this->run(
            'SELECT m.id AS match_id, m.matched_at, c.id AS conversation_id, c.last_message_at,
                    other.id AS user_id, other.display_name, other.is_online, other.is_verified,
                    ph.path AS avatar_path,
                    (SELECT body FROM messages msg WHERE msg.conversation_id = c.id ORDER BY msg.id DESC LIMIT 1) AS last_message,
                    (SELECT COUNT(*) FROM messages msg
                     JOIN conversation_members cm ON cm.conversation_id = msg.conversation_id AND cm.user_id = ?
                     WHERE msg.conversation_id = c.id AND msg.sender_id <> ?
                       AND (cm.last_read_message_id IS NULL OR msg.id > cm.last_read_message_id)) AS unread
             FROM matches m
             JOIN users other ON other.id = IF(m.user_lo = ?, m.user_hi, m.user_lo)
             LEFT JOIN conversations c ON c.match_id = m.id
             LEFT JOIN profiles p ON p.user_id = other.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE (m.user_lo = ? OR m.user_hi = ?) AND m.status = "active"
             ORDER BY c.last_message_at IS NULL, c.last_message_at DESC, m.matched_at DESC',
            [$userId, $userId, $userId, $userId, $userId]
        )->fetchAll();
    }

    public function unmatch(int $userId, int $otherId): void
    {
        $lo = min($userId, $otherId);
        $hi = max($userId, $otherId);
        $this->run('UPDATE matches SET status = "unmatched" WHERE user_lo = ? AND user_hi = ?', [$lo, $hi]);
    }

    public function areMatched(int $a, int $b): bool
    {
        $lo = min($a, $b);
        $hi = max($a, $b);
        return (bool) $this->run(
            'SELECT 1 FROM matches WHERE user_lo = ? AND user_hi = ? AND status = "active"',
            [$lo, $hi]
        )->fetchColumn();
    }
}

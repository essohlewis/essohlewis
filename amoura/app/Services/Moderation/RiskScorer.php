<?php
declare(strict_types=1);

namespace Amoura\Services\Moderation;

use Amoura\Core\Database;

/**
 * Score de risque anti-fraude (Sprint +6).
 * Combine des signaux faibles (âge du compte, photo, signalements, coordonnées
 * dans la bio, vélocité des actions, vérification) en un score 0–100 + niveau.
 * Interface volontairement simple pour un futur remplacement par un modèle ML.
 */
final class RiskScorer
{
    /**
     * @param array $s account_age_hours, has_photo, is_verified, reports_count,
     *                 bio, swipes_last_hour
     * @return array{score:int, level:string, flags:array<string>}
     */
    public static function score(array $s): array
    {
        $score = 0;
        $flags = [];

        if (($s['account_age_hours'] ?? 999) < 24) { $score += 15; $flags[] = 'new_account'; }
        if (empty($s['has_photo'])) { $score += 20; $flags[] = 'no_photo'; }

        $reports = (int) ($s['reports_count'] ?? 0);
        if ($reports > 0) { $score += min(45, $reports * 15); $flags[] = 'reported'; }

        // Coordonnées / arnaque dans la bio → réutilise le moteur de modération.
        if (!empty($s['bio'])) {
            $verdict = (new ContentModerator())->analyze((string) $s['bio']);
            if (array_intersect(['contact_phone', 'contact_email', 'contact_social', 'scam'], $verdict['flags'])) {
                $score += 25;
                $flags[] = 'bio_contact_or_scam';
            }
        }

        if ((int) ($s['swipes_last_hour'] ?? 0) > 100) { $score += 20; $flags[] = 'high_velocity'; }

        if (!empty($s['is_verified'])) { $score = max(0, $score - 20); }

        $score = max(0, min(100, $score));
        $level = $score >= 60 ? 'high' : ($score >= 30 ? 'medium' : 'low');
        return ['score' => $score, 'level' => $level, 'flags' => array_values(array_unique($flags))];
    }

    /** Rassemble les signaux d'un utilisateur depuis la base puis calcule le score. */
    public static function forUser(int $userId): array
    {
        $db = Database::connection();
        $u = $db->prepare('SELECT u.created_at, u.is_verified, p.bio, p.avatar_photo_id
                           FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?');
        $u->execute([$userId]);
        $row = $u->fetch();
        if (!$row) {
            return ['score' => 0, 'level' => 'low', 'flags' => []];
        }

        $count = function (string $sql) use ($db, $userId): int {
            $st = $db->prepare($sql);
            $st->execute([$userId]);
            return (int) $st->fetchColumn();
        };

        return self::score([
            'account_age_hours' => (time() - strtotime((string) $row['created_at'])) / 3600,
            'has_photo' => !empty($row['avatar_photo_id']),
            'is_verified' => (int) $row['is_verified'] === 1,
            'reports_count' => $count('SELECT COUNT(*) FROM reports WHERE target_type = "user" AND target_id = ?'),
            'bio' => (string) ($row['bio'] ?? ''),
            'swipes_last_hour' => $count('SELECT COUNT(*) FROM swipes WHERE actor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'),
        ]);
    }
}

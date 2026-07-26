<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Visites de profil — « qui a vu mon profil » (Sprint +2). */
final class ProfileView extends Model
{
    protected string $table = 'profile_views';

    /** Enregistre une visite (incrémente le compteur si déjà vu). Ignore l'auto-visite. */
    public function record(int $profileId, int $viewerId): void
    {
        if ($profileId === $viewerId) {
            return;
        }
        $this->run(
            'INSERT INTO profile_views (profile_id, viewer_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE views = views + 1, last_viewed_at = NOW()',
            [$profileId, $viewerId]
        );
    }

    /** Liste des visiteurs récents d'un profil (hors profils bloqués). */
    public function viewers(int $profileId, int $limit = 40): array
    {
        return $this->run(
            'SELECT pv.viewer_id AS id, pv.views, pv.last_viewed_at,
                    u.display_name, u.birthdate, u.is_verified, u.is_online,
                    ph.path AS avatar_path
             FROM profile_views pv
             JOIN users u ON u.id = pv.viewer_id AND u.status = "active"
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE pv.profile_id = ?
               AND NOT EXISTS (SELECT 1 FROM blocks b
                    WHERE (b.blocker_id = ? AND b.blocked_id = pv.viewer_id)
                       OR (b.blocker_id = pv.viewer_id AND b.blocked_id = ?))
             ORDER BY pv.last_viewed_at DESC LIMIT ?',
            [$profileId, $profileId, $profileId, $limit]
        )->fetchAll();
    }

    public function countFor(int $profileId): int
    {
        return (int) $this->run(
            'SELECT COUNT(*) FROM profile_views WHERE profile_id = ?',
            [$profileId]
        )->fetchColumn();
    }
}

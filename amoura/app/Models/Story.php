<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Statuts éphémères (24h). */
final class Story extends Model
{
    protected string $table = 'stories';

    public function publish(int $userId, array $data): int
    {
        return $this->create([
            'user_id' => $userId,
            'type' => in_array($data['type'] ?? '', ['image', 'text', 'video'], true) ? $data['type'] : 'image',
            'media_path' => $data['media_path'] ?? null,
            'caption' => $data['caption'] ?? null,
            'background' => $data['background'] ?? null,
            'expires_at' => date('Y-m-d H:i:s', time() + 86400),
        ]);
    }

    /**
     * Statuts actifs groupés par auteur, visibles pour $viewerId
     * (soi-même + ses matchs). Les statuts expirés sont filtrés.
     */
    public function activeFeed(int $viewerId): array
    {
        return $this->run(
            'SELECT s.*, u.display_name, ph.path AS avatar_path,
                    EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = ?) AS seen
             FROM stories s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE s.expires_at > NOW()
               AND (s.user_id = ? OR EXISTS (
                    SELECT 1 FROM matches m WHERE m.status = "active"
                    AND ((m.user_lo = ? AND m.user_hi = s.user_id) OR (m.user_hi = ? AND m.user_lo = s.user_id))
               ))
             ORDER BY s.user_id = ? DESC, s.created_at DESC',
            [$viewerId, $viewerId, $viewerId, $viewerId, $viewerId]
        )->fetchAll();
    }

    public function markViewed(int $storyId, int $viewerId): void
    {
        $this->run(
            'INSERT IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)',
            [$storyId, $viewerId]
        );
    }

    public function purgeExpired(): int
    {
        return $this->run('DELETE FROM stories WHERE expires_at < NOW()')->rowCount();
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Publications du mur / fil d'actualité. */
final class Post extends Model
{
    protected string $table = 'posts';

    public function createWithMedia(int $userId, string $body, string $visibility, array $mediaPaths = [], string $moderation = 'approved'): int
    {
        return $this->transaction(function ($db) use ($userId, $body, $visibility, $mediaPaths, $moderation) {
            $db->prepare('INSERT INTO posts (user_id, body, visibility, moderation) VALUES (?, ?, ?, ?)')
               ->execute([$userId, $body, $visibility, $moderation]);
            $postId = (int) $db->lastInsertId();
            $pos = 0;
            $stmt = $db->prepare('INSERT INTO post_media (post_id, path, position) VALUES (?, ?, ?)');
            foreach ($mediaPaths as $path) {
                $stmt->execute([$postId, $path, $pos++]);
            }
            return $postId;
        });
    }

    /**
     * Fil d'actualité paginé pour $viewerId :
     * posts publics + posts « matches » des personnes matchées + ses propres posts.
     */
    public function feed(int $viewerId, int $beforeId = 0, int $limit = 15): array
    {
        $cursor = $beforeId > 0 ? 'AND p.id < ?' : '';
        $params = [$viewerId, $viewerId, $viewerId, $viewerId];
        if ($beforeId > 0) {
            $params[] = $beforeId;
        }
        $params[] = $limit;

        $rows = $this->run(
            "SELECT p.*, u.display_name, u.is_verified, ph.path AS avatar_path,
                    EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS liked
             FROM posts p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN profiles pr ON pr.user_id = u.id
             LEFT JOIN photos ph ON ph.id = pr.avatar_photo_id
             WHERE p.deleted_at IS NULL AND p.moderation = 'approved'
               AND (
                    p.visibility = 'public'
                    OR p.user_id = ?
                    OR (p.visibility = 'matches' AND EXISTS (
                        SELECT 1 FROM matches m WHERE m.status='active'
                        AND ((m.user_lo=? AND m.user_hi=p.user_id) OR (m.user_hi=? AND m.user_lo=p.user_id))
                    ))
               )
               {$cursor}
             ORDER BY p.id DESC LIMIT ?",
            $params
        )->fetchAll();

        // Attache les médias.
        foreach ($rows as &$post) {
            $post['media'] = $this->run(
                'SELECT path, thumb_path FROM post_media WHERE post_id = ? ORDER BY position',
                [$post['id']]
            )->fetchAll();
        }
        return $rows;
    }

    public function toggleLike(int $postId, int $userId): array
    {
        return $this->transaction(function ($db) use ($postId, $userId) {
            $exists = $db->prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?');
            $exists->execute([$postId, $userId]);
            if ($exists->fetchColumn()) {
                $db->prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?')->execute([$postId, $userId]);
                $db->prepare('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ?')->execute([$postId]);
                $liked = false;
            } else {
                $db->prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)')->execute([$postId, $userId]);
                $db->prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?')->execute([$postId]);
                $liked = true;
            }
            $count = (int) $db->query("SELECT like_count FROM posts WHERE id = {$postId}")->fetchColumn();
            return ['liked' => $liked, 'like_count' => $count];
        });
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Comment extends Model
{
    protected string $table = 'comments';

    public function add(int $postId, int $userId, string $body, ?int $parentId = null): int
    {
        return $this->transaction(function ($db) use ($postId, $userId, $body, $parentId) {
            $db->prepare('INSERT INTO comments (post_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)')
               ->execute([$postId, $userId, $parentId, $body]);
            $id = (int) $db->lastInsertId();
            $db->prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?')->execute([$postId]);
            return $id;
        });
    }

    public function forPost(int $postId, int $limit = 50): array
    {
        return $this->run(
            'SELECT c.*, u.display_name, ph.path AS avatar_path
             FROM comments c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE c.post_id = ? AND c.deleted_at IS NULL
             ORDER BY c.created_at ASC LIMIT ?',
            [$postId, $limit]
        )->fetchAll();
    }
}

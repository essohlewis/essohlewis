<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Photo extends Model
{
    protected string $table = 'photos';

    public function forUser(int $userId): array
    {
        return $this->run(
            'SELECT * FROM photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC',
            [$userId]
        )->fetchAll();
    }

    public function countForUser(int $userId): int
    {
        return (int) $this->run('SELECT COUNT(*) FROM photos WHERE user_id = ?', [$userId])
            ->fetchColumn();
    }

    public function setPrimary(int $userId, int $photoId): void
    {
        $this->transaction(function ($db) use ($userId, $photoId) {
            $db->prepare('UPDATE photos SET is_primary = 0 WHERE user_id = ?')->execute([$userId]);
            $db->prepare('UPDATE photos SET is_primary = 1 WHERE id = ? AND user_id = ?')
               ->execute([$photoId, $userId]);
            $db->prepare('UPDATE profiles SET avatar_photo_id = ? WHERE user_id = ?')
               ->execute([$photoId, $userId]);
        });
    }

    /** File d'attente de modération des photos (admin). */
    public function pendingModeration(int $limit = 30): array
    {
        return $this->run(
            'SELECT ph.*, u.display_name FROM photos ph
             JOIN users u ON u.id = ph.user_id
             WHERE ph.moderation = "pending" ORDER BY ph.created_at ASC LIMIT ?',
            [$limit]
        )->fetchAll();
    }
}

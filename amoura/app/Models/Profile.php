<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Profile extends Model
{
    protected string $table = 'profiles';
    protected string $primaryKey = 'user_id';

    public function ensureExists(int $userId): void
    {
        $this->run(
            'INSERT IGNORE INTO profiles (user_id) VALUES (?)',
            [$userId]
        );
        $this->run('INSERT IGNORE INTO privacy_settings (user_id) VALUES (?)', [$userId]);
    }

    public function upsert(int $userId, array $data): void
    {
        $this->ensureExists($userId);
        $this->update($userId, $data);
        $this->recomputeCompletion($userId);
    }

    /** Recalcule le pourcentage de complétude (incite à remplir le profil). */
    public function recomputeCompletion(int $userId): void
    {
        $p = $this->find($userId);
        if (!$p) {
            return;
        }
        $fields = ['bio', 'orientation', 'country', 'city', 'interests', 'languages', 'avatar_photo_id'];
        $filled = 0;
        foreach ($fields as $f) {
            if (!empty($p[$f])) {
                $filled++;
            }
        }
        $completion = (int) round($filled / count($fields) * 100);
        $this->run('UPDATE profiles SET completion = ? WHERE user_id = ?', [$completion, $userId]);
    }

    public function privacy(int $userId): array
    {
        $stmt = $this->run('SELECT * FROM privacy_settings WHERE user_id = ?', [$userId]);
        return $stmt->fetch() ?: [];
    }

    /** Le membre a-t-il activé la navigation privée (incognito) ? */
    public function isIncognito(int $userId): bool
    {
        return (bool) $this->run(
            'SELECT incognito FROM privacy_settings WHERE user_id = ?',
            [$userId]
        )->fetchColumn();
    }

    public function updatePrivacy(int $userId, array $data): void
    {
        $allowed = ['show_online', 'show_distance', 'show_age', 'show_last_active',
                    'discoverable', 'incognito', 'read_receipts', 'allow_messages_from'];
        $sets = [];
        $params = [];
        foreach ($allowed as $col) {
            if (array_key_exists($col, $data)) {
                $sets[] = "`{$col}` = ?";
                $params[] = $data[$col];
            }
        }
        if (!$sets) {
            return;
        }
        $params[] = $userId;
        $this->run('UPDATE privacy_settings SET ' . implode(', ', $sets) . ' WHERE user_id = ?', $params);
    }
}

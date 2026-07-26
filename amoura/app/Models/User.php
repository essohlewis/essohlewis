<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class User extends Model
{
    protected string $table = 'users';

    public function byEmail(string $email): ?array
    {
        return $this->findBy('email', $email);
    }

    public function byPhone(string $phone): ?array
    {
        return $this->findBy('phone', $phone);
    }

    /** Marque la présence en ligne / hors-ligne (mis à jour par le WebSocket). */
    public function setOnline(int $userId, bool $online): void
    {
        $this->run(
            'UPDATE users SET is_online = ?, last_active_at = NOW() WHERE id = ?',
            [$online ? 1 : 0, $userId]
        );
    }

    public function markActive(int $userId): void
    {
        $this->run('UPDATE users SET last_active_at = NOW() WHERE id = ?', [$userId]);
    }

    /** Profil « riche » assemblé (user + profile + photo principale) pour l'affichage. */
    public function fullProfile(int $userId): ?array
    {
        $stmt = $this->run(
            'SELECT u.id, u.display_name, u.birthdate, u.gender, u.is_verified, u.is_online,
                    u.last_active_at, u.status,
                    p.bio, p.orientation, p.looking_for, p.country, p.city, p.latitude, p.longitude,
                    p.languages, p.interests, p.job_title, p.education, p.completion,
                    ph.path AS avatar_path
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN photos  ph ON ph.id = p.avatar_photo_id
             WHERE u.id = ? LIMIT 1',
            [$userId]
        );
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Statistiques agrégées pour le tableau de bord admin. */
    public function adminStats(): array
    {
        $db = $this->db;
        $count = fn(string $sql) => (int) $db->query($sql)->fetchColumn();
        return [
            'total'       => $count('SELECT COUNT(*) FROM users WHERE status <> "deleted"'),
            'active'      => $count('SELECT COUNT(*) FROM users WHERE status = "active"'),
            'online'      => $count('SELECT COUNT(*) FROM users WHERE is_online = 1'),
            'today'       => $count('SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()'),
            'verified'    => $count('SELECT COUNT(*) FROM users WHERE is_verified = 1'),
        ];
    }

    /** Recherche paginée pour l'admin (par nom/email/téléphone). */
    public function search(string $term = '', string $status = '', int $limit = 25, int $offset = 0): array
    {
        $where = ['status <> "deleted"'];
        $params = [];
        if ($term !== '') {
            $where[] = '(display_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = '%' . $term . '%';
            array_push($params, $like, $like, $like);
        }
        if ($status !== '') {
            $where[] = 'status = ?';
            $params[] = $status;
        }
        $sql = 'SELECT id, display_name, email, phone, status, is_verified, is_online, created_at
                FROM users WHERE ' . implode(' AND ', $where)
              . ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        array_push($params, $limit, $offset);
        return $this->run($sql, $params)->fetchAll();
    }
}

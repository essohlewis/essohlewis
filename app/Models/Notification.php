<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Notification utilisateur (transaction, promo, expiration, nouveauté, échec).
 * Alimente le centre de notifications et le compteur de la cloche.
 */
final class Notification extends Model
{
    protected static string $table = 'notifications';

    public ?int $id = null;
    public int $userId = 0;
    public string $type = 'systeme';   // transaction | promo | expiration | nouveaute | echec | systeme
    public string $title = '';
    public ?string $body = null;
    public ?string $link = null;
    public bool $isRead = false;
    public ?string $createdAt = null;

    public static function push(int $userId, string $type, string $title, ?string $body = null, ?string $link = null): void
    {
        self::pdo()->prepare(
            'INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at)
             VALUES (:uid, :type, :title, :body, :link, 0, NOW())'
        )->execute([
            'uid'   => $userId,
            'type'  => $type,
            'title' => $title,
            'body'  => $body,
            'link'  => $link,
        ]);
    }

    /** @return self[] */
    public static function forUser(int $userId, int $limit = 50): array
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM notifications WHERE user_id = :uid ORDER BY id DESC LIMIT :lim'
        );
        $stmt->bindValue('uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    public static function unreadCount(int $userId): int
    {
        $stmt = self::pdo()->prepare(
            'SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0'
        );
        $stmt->execute(['uid' => $userId]);
        return (int) $stmt->fetchColumn();
    }

    public static function markAllRead(int $userId): void
    {
        self::pdo()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = :uid AND is_read = 0')
            ->execute(['uid' => $userId]);
    }

    public function icon(): string
    {
        return match ($this->type) {
            'transaction' => '✅',
            'promo'       => '🎁',
            'expiration'  => '⏳',
            'nouveaute'   => '✨',
            'echec'       => '⚠️',
            default       => '🔔',
        };
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Abonnements aux notifications Web Push (Sprint +2). */
final class PushSubscription extends Model
{
    protected string $table = 'push_subscriptions';

    /** Enregistre (ou met à jour) un abonnement push pour un utilisateur. */
    public function store(int $userId, string $endpoint, string $p256dh, string $auth, ?string $userAgent): void
    {
        $this->run(
            'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh),
                                     auth = VALUES(auth), user_agent = VALUES(user_agent)',
            [$userId, $endpoint, $p256dh, $auth, $userAgent]
        );
    }

    public function forUser(int $userId): array
    {
        return $this->run('SELECT * FROM push_subscriptions WHERE user_id = ?', [$userId])->fetchAll();
    }

    public function deleteByEndpoint(string $endpoint): void
    {
        $this->run('DELETE FROM push_subscriptions WHERE endpoint = ?', [$endpoint]);
    }
}

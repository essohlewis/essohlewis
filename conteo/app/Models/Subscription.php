<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class Subscription extends Model
{
    protected string $table = 'subscriptions';

    /**
     * Abonnement actif et non expiré de l'utilisateur, s'il existe.
     * @return array<string,mixed>|null
     */
    public function activeForUser(int $userId): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM subscriptions
             WHERE user_id = ? AND status = "active" AND ends_at > NOW()
             ORDER BY ends_at DESC LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Active/prolonge un abonnement après paiement vérifié. */
    public function activate(int $subscriptionId, string $plan): void
    {
        $months = $plan === 'yearly' ? 12 : 1;
        $now = new \DateTimeImmutable('now');
        $ends = $now->modify("+{$months} months");
        $stmt = $this->db()->prepare(
            'UPDATE subscriptions
             SET status = "active", starts_at = ?, ends_at = ?
             WHERE id = ?'
        );
        $stmt->execute([$now->format('Y-m-d H:i:s'), $ends->format('Y-m-d H:i:s'), $subscriptionId]);
    }
}

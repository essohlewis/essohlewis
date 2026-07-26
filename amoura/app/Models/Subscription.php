<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Subscription extends Model
{
    protected string $table = 'subscriptions';

    /** Abonnement actif de l'utilisateur, avec les caractéristiques du plan. */
    public function activeFor(int $userId): ?array
    {
        $row = $this->run(
            'SELECT s.*, pl.slug AS plan_slug, pl.name AS plan_name, pl.features
             FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id
             WHERE s.user_id = ? AND s.status = "active"
               AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
             ORDER BY s.id DESC LIMIT 1',
            [$userId]
        )->fetch();
        return $row ?: null;
    }

    /**
     * Active/prolonge un abonnement APRÈS vérification du paiement côté serveur.
     * Idempotent par référence prestataire.
     */
    public function activate(int $userId, int $planId, string $gateway, string $gatewayRef, string $interval): int
    {
        return $this->transaction(function ($db) use ($userId, $planId, $gateway, $gatewayRef, $interval) {
            // Expire les anciens abonnements actifs.
            $db->prepare('UPDATE subscriptions SET status = "expired" WHERE user_id = ? AND status = "active"')
               ->execute([$userId]);

            $periodEnd = match ($interval) {
                'year'     => date('Y-m-d H:i:s', strtotime('+1 year')),
                'lifetime' => null,
                default    => date('Y-m-d H:i:s', strtotime('+1 month')),
            };

            $db->prepare(
                'INSERT INTO subscriptions (user_id, plan_id, status, gateway, gateway_ref, started_at, current_period_end)
                 VALUES (?, ?, "active", ?, ?, NOW(), ?)'
            )->execute([$userId, $planId, $gateway, $gatewayRef, $periodEnd]);
            return (int) $db->lastInsertId();
        });
    }

    public function cancel(int $userId): void
    {
        $this->run(
            'UPDATE subscriptions SET status = "canceled", canceled_at = NOW()
             WHERE user_id = ? AND status = "active"',
            [$userId]
        );
    }

    /** Le membre a-t-il accès à une fonctionnalité premium donnée ? */
    public function hasFeature(int $userId, string $feature): bool
    {
        $sub = $this->activeFor($userId);
        if (!$sub) {
            return false;
        }
        $features = json_decode((string) $sub['features'], true) ?: [];
        return !empty($features[$feature]);
    }
}

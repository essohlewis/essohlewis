<?php
declare(strict_types=1);

namespace Amoura\Services\Billing;

use Amoura\Models\ActivityLog;
use Amoura\Models\Credit;
use Amoura\Models\Notification;
use Amoura\Models\Plan;
use Amoura\Models\Product;
use Amoura\Models\Subscription;
use Amoura\Models\Transaction;

/**
 * Exécution d'un paiement vérifié (Sprint +5).
 * Gère de façon idempotente les deux types d'achat :
 *  - abonnement (plan_id) → active/prolonge la souscription ;
 *  - achat à l'unité (product_id) → crédite le portefeuille (Boost/Super Like/Reveal).
 */
final class Fulfillment
{
    /**
     * @return bool true si l'exécution a eu lieu (première confirmation).
     */
    public static function complete(array $tx, string $gatewayRef): bool
    {
        $txModel = new Transaction();
        // markPaid renvoie true uniquement lors de la PREMIÈRE confirmation (idempotence).
        if (!$txModel->markPaid((int) $tx['id'], $gatewayRef)) {
            return false;
        }

        // Achat à l'unité (consommable).
        if (!empty($tx['product_id'])) {
            $product = (new Product())->find((int) $tx['product_id']);
            if ($product) {
                (new Credit())->grant((int) $tx['user_id'], (string) $product['item'], (int) $product['quantity']);
                (new Notification())->push((int) $tx['user_id'], 'payment', null, ['product' => $product['name']]);
                (new ActivityLog())->record((int) $tx['user_id'], 'purchase.completed', 'transaction', (int) $tx['id'], ['product' => $product['slug']]);
            }
            return true;
        }

        // Abonnement.
        $plan = (new Plan())->find((int) $tx['plan_id']);
        if (!$plan) {
            return true; // paiement encaissé mais plan introuvable — journalisé côté appelant
        }
        $subId = (new Subscription())->activate(
            (int) $tx['user_id'], (int) $plan['id'], (string) $tx['gateway'], $gatewayRef, (string) $plan['interval']
        );
        $txModel->update((int) $tx['id'], ['subscription_id' => $subId]);
        (new Notification())->push((int) $tx['user_id'], 'payment', null, ['plan' => $plan['name']]);
        (new ActivityLog())->record((int) $tx['user_id'], 'payment.completed', 'transaction', (int) $tx['id'], ['plan' => $plan['slug']]);
        return true;
    }
}

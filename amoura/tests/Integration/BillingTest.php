<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Controllers\SubscriptionController;
use Amoura\Models\Plan;
use Amoura\Models\Subscription;
use Amoura\Models\Transaction;

/**
 * Vérifie l'activation d'abonnement après paiement : idempotence (le webhook ET
 * le retour navigateur peuvent appeler fulfill()) et non-double-facturation.
 */
final class BillingTest extends IntegrationTestCase
{
    public function testFulfillActivatesSubscriptionOnce(): void
    {
        $user = $this->makeUser('buyer@test.io');
        $plan = (new Plan())->bySlug('premium');
        $this->assertNotNull($plan);

        $txModel = new Transaction();
        $txId = $txModel->initiate($user, (int) $plan['id'], (int) $plan['price_cents'], 'XOF', 'cinetpay');
        $txModel->update($txId, ['gateway_ref' => 'REF-123', 'status' => 'pending']);
        $tx = $txModel->find($txId);

        // Première confirmation (ex. retour navigateur).
        SubscriptionController::fulfill($tx, 'REF-123');
        // Deuxième confirmation (ex. webhook) — ne doit PAS créer de doublon.
        SubscriptionController::fulfill($txModel->find($txId), 'REF-123');

        $active = (new Subscription())->activeFor($user);
        $this->assertNotNull($active, 'l\'abonnement doit être actif');
        $this->assertSame('premium', $active['plan_slug']);

        $subCount = (int) $this->db->query("SELECT COUNT(*) FROM subscriptions WHERE user_id = {$user} AND status = 'active'")->fetchColumn();
        $this->assertSame(1, $subCount, 'un seul abonnement actif malgré deux confirmations');

        $paidCount = (int) $this->db->query("SELECT COUNT(*) FROM transactions WHERE id = {$txId} AND status = 'paid'")->fetchColumn();
        $this->assertSame(1, $paidCount);
    }

    public function testMarkPaidIsIdempotent(): void
    {
        $user = $this->makeUser('payer@test.io');
        $txModel = new Transaction();
        $txId = $txModel->initiate($user, 2, 350000, 'XOF', 'stripe');

        $this->assertTrue($txModel->markPaid($txId, 'CS-1'), 'première confirmation = true');
        $this->assertFalse($txModel->markPaid($txId, 'CS-1'), 'confirmation répétée = false (déjà payé)');
    }

    public function testPremiumFeatureGate(): void
    {
        $user = $this->makeUser('free@test.io');
        $subs = new Subscription();
        $this->assertFalse($subs->hasFeature($user, 'unlimited_likes'), 'compte gratuit : pas de likes illimités');

        // Active un VIP et revérifie.
        $vip = (new Plan())->bySlug('vip');
        $subs->activate($user, (int) $vip['id'], 'manual', 'M-1', 'month');
        $this->assertTrue($subs->hasFeature($user, 'unlimited_likes'), 'VIP : likes illimités');
        $this->assertTrue($subs->hasFeature($user, 'incognito'));
    }
}

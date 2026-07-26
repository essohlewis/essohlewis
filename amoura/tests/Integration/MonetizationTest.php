<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Credit;
use Amoura\Models\Product;
use Amoura\Models\Subscription;
use Amoura\Models\Transaction;
use Amoura\Services\Billing\Fulfillment;

/**
 * Sprint +5 : portefeuille de crédits, achats à l'unité et exécution des paiements.
 */
final class MonetizationTest extends IntegrationTestCase
{
    public function testCreditWalletGrantAndConsume(): void
    {
        $uid = $this->makeUser('wallet@test.io');
        $credit = new Credit();

        $this->assertFalse($credit->consume($uid, 'superlike'), 'solde vide → pas de débit');
        $credit->grant($uid, 'superlike', 5);
        $this->assertSame(5, $credit->balance($uid, 'superlike'));

        $this->assertTrue($credit->consume($uid, 'superlike'));
        $this->assertSame(4, $credit->balance($uid, 'superlike'));
        $this->assertFalse($credit->consume($uid, 'superlike', 10), 'solde insuffisant');
        $this->assertSame(4, $credit->balance($uid, 'superlike'), 'aucun débit si insuffisant');
    }

    public function testProductPurchaseGrantsCreditsIdempotently(): void
    {
        $uid = $this->makeUser('buyer@test.io');
        $product = (new Product())->bySlug('superlike-5'); // accorde 5 super likes
        $this->assertNotNull($product);

        $txModel = new Transaction();
        $txId = $txModel->initiate($uid, null, (int) $product['price_cents'], 'XOF', 'cinetpay', [
            'product_id' => (int) $product['id'],
        ]);
        $txModel->update($txId, ['gateway_ref' => 'REF-P1', 'status' => 'pending']);
        $tx = $txModel->find($txId);

        // Première confirmation → crédite ; deuxième (webhook) → sans effet.
        $this->assertTrue(Fulfillment::complete($tx, 'REF-P1'));
        $this->assertFalse(Fulfillment::complete($txModel->find($txId), 'REF-P1'));

        $this->assertSame(5, (new Credit())->balance($uid, 'superlike'));
        $paid = $this->db->query("SELECT COUNT(*) FROM transactions WHERE id={$txId} AND status='paid'")->fetchColumn();
        $this->assertSame(1, (int) $paid);
    }

    public function testPlanPurchaseStillActivatesSubscription(): void
    {
        $uid = $this->makeUser('sub@test.io');
        $txModel = new Transaction();
        // plan_id 2 = premium (seed)
        $txId = $txModel->initiate($uid, 2, 350000, 'XOF', 'stripe');
        $txModel->update($txId, ['gateway_ref' => 'CS-1', 'status' => 'pending']);

        Fulfillment::complete($txModel->find($txId), 'CS-1');

        $active = (new Subscription())->activeFor($uid);
        $this->assertNotNull($active);
        $this->assertSame('premium', $active['plan_slug']);
    }
}

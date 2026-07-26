<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Coupon;
use Amoura\Models\Message;
use Amoura\Models\Plan;
use Amoura\Models\Report;
use Amoura\Models\Swipe;
use Amoura\Models\Transaction;
use Amoura\Services\Security\DeviceMonitor;

/**
 * Fonctionnalités de durcissement (Sprint +6) : chiffrement des messages au repos,
 * réponses citées, messages éphémères, coupons, détection d'appareils,
 * priorisation & résolution en masse des signalements.
 */
final class PlatformHardeningTest extends IntegrationTestCase
{
    /** Ouvre une conversation entre deux nouveaux utilisateurs via un match. */
    private function makeConversation(): array
    {
        $a = $this->makeUser('msg-a@test.io');
        $b = $this->makeUser('msg-b@test.io', 'male');
        $swipe = new Swipe();
        $swipe->act($a, $b, 'like');
        $match = $swipe->act($b, $a, 'like');
        return [$a, $b, (int) $match['conversation_id']];
    }

    public function testMessageBodyIsEncryptedAtRest(): void
    {
        if (!function_exists('sodium_crypto_secretbox')) {
            $this->markTestSkipped('libsodium indisponible.');
        }
        [$a, , $conv] = $this->makeConversation();
        $message = new Message();
        $id = $message->send($conv, $a, ['type' => 'text', 'body' => 'Secret ❤']);

        // En base : chiffré (préfixe enc:). Via l'API history() : déchiffré.
        $raw = $this->db->query("SELECT body FROM messages WHERE id = {$id}")->fetchColumn();
        $this->assertStringStartsWith('enc:', (string) $raw, 'le corps est chiffré au repos');
        $this->assertStringNotContainsString('Secret', (string) $raw);

        $history = $message->history($conv);
        $this->assertSame('Secret ❤', $history[count($history) - 1]['body']);
    }

    public function testQuotedReply(): void
    {
        [$a, $b, $conv] = $this->makeConversation();
        $message = new Message();
        $first = $message->send($conv, $a, ['type' => 'text', 'body' => 'Question ?']);
        $message->send($conv, $b, ['type' => 'text', 'body' => 'Réponse.', 'reply_to_id' => $first]);

        $history = $message->history($conv);
        $reply = $history[count($history) - 1];
        $this->assertSame('Réponse.', $reply['body']);
        $this->assertSame($first, (int) $reply['reply_to_id']);
        $this->assertSame('Question ?', $reply['reply_body'], 'le corps cité est déchiffré');
    }

    public function testEphemeralMessageExcludedAfterExpiry(): void
    {
        [$a, , $conv] = $this->makeConversation();
        $message = new Message();
        $id = $message->send($conv, $a, ['type' => 'text', 'body' => 'éphémère', 'ttl' => 60]);

        // Présent tant que non expiré.
        $this->assertCount(1, $message->history($conv));

        // Force l'expiration dans le passé → exclu de l'historique.
        $this->db->exec("UPDATE messages SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = {$id}");
        $this->assertCount(0, $message->history($conv));
    }

    public function testCouponValidationApplicationAndRedemption(): void
    {
        $this->db->exec(
            "INSERT INTO coupons (code, percent_off, max_redemptions, is_active)
             VALUES ('BIENVENUE20', 20, 2, 1)"
        );
        $coupon = new Coupon();

        $found = $coupon->valid('bienvenue20'); // insensible à la casse
        $this->assertNotNull($found);
        $this->assertSame(800, Coupon::apply($found, 1000));

        // Deux rachats autorisés, le troisième refusé (plafond atteint).
        $this->assertTrue($coupon->redeem((int) $found['id']));
        $this->assertTrue($coupon->redeem((int) $found['id']));
        $this->assertFalse($coupon->redeem((int) $found['id']));
        $this->assertNull($coupon->valid('BIENVENUE20'), 'plus valide une fois épuisé');
    }

    public function testInactiveAndExpiredCouponsAreInvalid(): void
    {
        $this->db->exec("INSERT INTO coupons (code, percent_off, is_active) VALUES ('INACTIF', 50, 0)");
        $this->db->exec("INSERT INTO coupons (code, percent_off, is_active, expires_at)
                         VALUES ('PERIME', 50, 1, DATE_SUB(NOW(), INTERVAL 1 DAY))");
        $coupon = new Coupon();
        $this->assertNull($coupon->valid('INACTIF'));
        $this->assertNull($coupon->valid('PERIME'));
    }

    public function testDeviceMonitorTracksAndAlerts(): void
    {
        $user = $this->makeUser('device@test.io');

        // Premier appareil : enregistré, pas d'alerte.
        $this->assertTrue(DeviceMonitor::track($user, 'Mozilla/5.0 Firefox', '203.0.113.5'));
        // Même appareil (même /24) : reconnu.
        $this->assertFalse(DeviceMonitor::track($user, 'Mozilla/5.0 Firefox', '203.0.113.200'));
        // Nouvel appareil : enregistré + alerte.
        $this->assertTrue(DeviceMonitor::track($user, 'Chrome Android', '198.51.100.7'));

        $devices = (int) $this->db->query("SELECT COUNT(*) FROM login_devices WHERE user_id = {$user}")->fetchColumn();
        $this->assertSame(2, $devices);

        $alerts = (int) $this->db->query(
            "SELECT COUNT(*) FROM notifications WHERE user_id = {$user} AND type = 'system'"
        )->fetchColumn();
        $this->assertSame(1, $alerts, 'une alerte pour le second appareil uniquement');
    }

    public function testReportQueueOrdersBySeverity(): void
    {
        $reporter = $this->makeUser('reporter@test.io');
        $t1 = $this->makeUser('t1@test.io', 'male');
        $t2 = $this->makeUser('t2@test.io', 'male');
        $report = new Report();
        // « harassment » (sévérité 3) créé avant « underage » (sévérité 0).
        $report->file($reporter, 'user', $t1, 'harassment', null);
        $report->file($reporter, 'user', $t2, 'underage', null);

        $queue = $report->queue('open');
        $this->assertSame('underage', $queue[0]['reason'], 'le plus grave remonte en tête');
        $this->assertSame('harassment', $queue[1]['reason']);
    }

    public function testBulkResolveOnlyAffectsOpenReports(): void
    {
        $reporter = $this->makeUser('rep@test.io');
        $staff = $this->makeUser('staff@test.io', 'male');
        $target = $this->makeUser('bad@test.io', 'male');
        $report = new Report();
        $id1 = $report->file($reporter, 'user', $target, 'spam', null);
        $id2 = $report->file($reporter, 'user', $target, 'fake', null);
        // Déjà traité → non repris par la résolution en masse.
        $report->resolve($id2, $staff, 'dismissed');

        $affected = $report->bulkResolve([$id1, $id2], $staff, 'actioned');
        $this->assertSame(1, $affected, 'seul le signalement ouvert est résolu');

        $status = $this->db->query("SELECT status FROM reports WHERE id = {$id1}")->fetchColumn();
        $this->assertSame('actioned', $status);
    }

    public function testBillingHistoryAndReceiptScope(): void
    {
        $buyer = $this->makeUser('buyer@test.io');
        $other = $this->makeUser('other@test.io', 'male');
        $plan = (new Plan())->bySlug('premium');
        $tx = new Transaction();

        // Une transaction payée et une échouée pour l'acheteur.
        $paidId = $tx->initiate($buyer, (int) $plan['id'], (int) $plan['price_cents'], 'XOF', 'stripe');
        $tx->markPaid($paidId, 'CS-RECEIPT-1');
        $failId = $tx->initiate($buyer, (int) $plan['id'], (int) $plan['price_cents'], 'XOF', 'stripe');
        $tx->markFailed($failId);

        $history = $tx->forUser($buyer);
        $this->assertCount(2, $history, 'l\'historique liste toutes les transactions de l\'utilisateur');
        $this->assertSame('Premium', $history[0]['plan_name'] ?? $history[1]['plan_name']);

        // Reçu : seulement pour une transaction PAYÉE appartenant à l'utilisateur.
        $this->assertNotNull($tx->receiptFor($paidId, $buyer));
        $this->assertNull($tx->receiptFor($failId, $buyer), 'pas de reçu pour un échec');
        $this->assertNull($tx->receiptFor($paidId, $other), 'pas de reçu pour la transaction d\'autrui');
    }
}

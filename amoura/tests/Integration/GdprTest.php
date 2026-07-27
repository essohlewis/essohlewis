<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Consent;
use Amoura\Models\Message;
use Amoura\Models\Swipe;
use Amoura\Models\Transaction;
use Amoura\Services\Gdpr\DataErasure;
use Amoura\Services\Gdpr\DataExport;
use Amoura\Services\Security\DeviceMonitor;

/**
 * Conformité RGPD (Phase 4, Sprint +9) : consentements, export (accès &
 * portabilité) et effacement (droit à l'oubli).
 */
final class GdprTest extends IntegrationTestCase
{
    public function testConsentJournalTracksLatestState(): void
    {
        $uid = $this->makeUser('consent@test.io');
        $c = new Consent();

        $c->record($uid, 'privacy_policy', true, '1.0', '203.0.113.1');
        $c->record($uid, 'marketing', true, '1.0', '203.0.113.1');
        $c->record($uid, 'marketing', false, '1.0', '203.0.113.1'); // retrait

        $current = $c->current($uid);
        $this->assertTrue($current['privacy_policy']);
        $this->assertFalse($current['marketing'], 'le dernier état l\'emporte');
        $this->assertFalse($c->has($uid, 'marketing'));
        $this->assertTrue($c->has($uid, 'privacy_policy'));

        // Historique append-only : 3 lignes conservées comme preuve.
        $this->assertCount(3, $c->history($uid));
    }

    public function testDataExportContainsPersonalDataDecrypted(): void
    {
        $a = $this->makeUser('exporter@test.io');
        $b = $this->makeUser('peer@test.io', 'male');
        $swipe = new Swipe();
        $swipe->act($a, $b, 'like');
        $match = $swipe->act($b, $a, 'like');
        $conv = (int) $match['conversation_id'];
        (new Message())->send($conv, $a, ['type' => 'text', 'body' => 'Message perso 42']);
        (new Consent())->record($a, 'terms', true, '1.0', '203.0.113.9');

        $export = DataExport::forUser($a);

        $this->assertSame($a, (int) $export['account']['id']);
        $this->assertArrayNotHasKey('password_hash', $export['account'], 'aucun secret exporté');
        $this->assertNotEmpty($export['consents']);
        $this->assertNotEmpty($export['messages_sent']);
        // Le corps est déchiffré pour la portabilité.
        $this->assertSame('Message perso 42', $export['messages_sent'][0]['body']);
        $this->assertNotEmpty($export['matches']);
    }

    public function testErasureAnonymizesAccountAndPurgesPersonalData(): void
    {
        $a = $this->makeUser('erase@test.io');
        $b = $this->makeUser('friend@test.io', 'male');
        $swipe = new Swipe();
        $swipe->act($a, $b, 'like');
        $match = $swipe->act($b, $a, 'like');
        $conv = (int) $match['conversation_id'];
        (new Message())->send($conv, $a, ['type' => 'text', 'body' => 'à effacer']);
        DeviceMonitor::track($a, 'Firefox', '203.0.113.5');
        (new Consent())->record($a, 'marketing', true, '1.0', '203.0.113.5');

        // Transaction payée (registre comptable à conserver).
        $tx = new Transaction();
        $txId = $tx->initiate($a, 1, 350000, 'XOF', 'stripe');
        $tx->markPaid($txId, 'CS-ERASE-1');

        $result = DataErasure::erase($a);

        // Compte anonymisé (ligne conservée pour l'intégrité référentielle).
        $account = $this->db->query("SELECT * FROM users WHERE id = {$a}")->fetch();
        $this->assertNull($account['email']);
        $this->assertSame('deleted', $account['status']);
        $this->assertSame('Compte supprimé', $account['display_name']);
        $this->assertNotNull($account['deleted_at']);

        // Données personnelles purgées / neutralisées.
        $this->assertNull($this->db->query("SELECT bio FROM profiles WHERE user_id = {$a}")->fetchColumn() ?: null);
        $this->assertNull($this->db->query("SELECT body FROM messages WHERE sender_id = {$a}")->fetchColumn());
        $this->assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM login_devices WHERE user_id = {$a}")->fetchColumn());
        $this->assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM swipes WHERE actor_id = {$a}")->fetchColumn());
        $this->assertGreaterThan(0, $result['messages']);

        // Registre financier CONSERVÉ.
        $this->assertSame(1, (int) $this->db->query("SELECT COUNT(*) FROM transactions WHERE id = {$txId}")->fetchColumn());

        // Preuve de l'effacement journalisée.
        $this->assertSame(1, (int) $this->db->query(
            "SELECT COUNT(*) FROM activity_logs WHERE user_id = {$a} AND action = 'gdpr.erased'"
        )->fetchColumn());
    }
}

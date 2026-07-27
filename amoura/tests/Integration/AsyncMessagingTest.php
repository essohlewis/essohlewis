<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Outbox;
use Amoura\Services\Messaging\Dispatcher;
use Amoura\Services\Sms\SmsGateway;
use Amoura\Services\Sms\SmsManager;

/**
 * File d'envoi asynchrone e-mail/SMS (Phase 1, Sprint +7) : mise en file,
 * réclamation de lot, livraison, relances à backoff.
 */
final class AsyncMessagingTest extends IntegrationTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('QUEUE_DRIVER=async');
        putenv('MAIL_DRIVER=log');
    }

    protected function tearDown(): void
    {
        putenv('QUEUE_DRIVER');
        putenv('MAIL_DRIVER');
        SmsManager::setGateway(null);
    }

    /** Passerelle SMS de test : enregistre les envois, échec optionnel. */
    private function fakeGateway(bool $fail = false): SmsGateway
    {
        return new class($fail) implements SmsGateway {
            public array $sent = [];
            public function __construct(private bool $fail) {}
            public function send(string $to, string $message): array
            {
                $this->sent[] = [$to, $message];
                return $this->fail
                    ? ['ok' => false, 'error' => 'prestataire indisponible']
                    : ['ok' => true, 'ref' => 'FAKE-' . count($this->sent)];
            }
        };
    }

    public function testAsyncEmailIsQueuedThenDelivered(): void
    {
        $ok = Dispatcher::email('user@test.io', 'Sujet', '<p>Bonjour</p>');
        $this->assertTrue($ok);

        // En file, pas encore envoyé.
        $row = $this->db->query("SELECT * FROM message_outbox WHERE recipient='user@test.io'")->fetch();
        $this->assertSame('pending', $row['status']);
        $this->assertSame('email', $row['channel']);

        // Drain → livré (pilote log).
        $res = Dispatcher::drain();
        $this->assertSame(1, $res['sent']);
        $this->assertSame(0, $res['failed']);

        $row = $this->db->query("SELECT * FROM message_outbox WHERE recipient='user@test.io'")->fetch();
        $this->assertSame('sent', $row['status']);
        $this->assertNotNull($row['sent_at']);
    }

    public function testAsyncSmsUsesGatewayAndRecordsRef(): void
    {
        $gw = $this->fakeGateway();
        SmsManager::setGateway($gw);

        Dispatcher::sms('+2250700000000', 'Code : 000000');
        $res = Dispatcher::drain();

        $this->assertSame(1, $res['sent']);
        $this->assertCount(1, $gw->sent, 'la passerelle a bien été appelée');
        $ref = $this->db->query("SELECT provider_ref FROM message_outbox WHERE channel='sms'")->fetchColumn();
        $this->assertStringStartsWith('FAKE-', (string) $ref);
    }

    public function testFailureSchedulesRetryWithBackoff(): void
    {
        SmsManager::setGateway($this->fakeGateway(fail: true));
        Dispatcher::sms('+2250700000001', 'échouera');

        $res = Dispatcher::drain();
        $this->assertSame(0, $res['sent']);
        $this->assertSame(1, $res['failed']);

        $row = $this->db->query("SELECT * FROM message_outbox WHERE channel='sms'")->fetch();
        $this->assertSame('failed', $row['status']);
        $this->assertSame(1, (int) $row['attempts']);
        $this->assertNotNull($row['last_error']);
        // Replanifié dans le futur (backoff) → non repris immédiatement.
        $this->assertGreaterThan(0, (int) $this->db->query(
            "SELECT next_attempt_at > NOW() FROM message_outbox WHERE channel='sms'"
        )->fetchColumn());
        $this->assertEmpty(Dispatcher::drain()['processed'] ? [1] : [], 'rien de dû dans l\'immédiat');
    }

    public function testDeadLetterAfterMaxAttempts(): void
    {
        SmsManager::setGateway($this->fakeGateway(fail: true));
        $id = (new Outbox())->enqueue('sms', '+2250700000002', null, 'toujours en échec');

        // Force le compteur juste sous le plafond et rend le message dû.
        $this->db->exec("UPDATE message_outbox SET attempts = 4, max_attempts = 5,
                         next_attempt_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = {$id}");

        $res = Dispatcher::drain();
        $this->assertSame(1, $res['failed']);

        $row = $this->db->query("SELECT status, attempts FROM message_outbox WHERE id = {$id}")->fetch();
        $this->assertSame('failed', $row['status']);
        $this->assertSame(5, (int) $row['attempts']);
        // Plafond atteint → n'est plus réclamé (attempts >= max_attempts).
        $this->db->exec("UPDATE message_outbox SET next_attempt_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = {$id}");
        $this->assertCount(0, (new Outbox())->claimBatch());
    }

    public function testCountsReflectStates(): void
    {
        $ob = new Outbox();
        $ob->enqueue('email', 'a@test.io', 'S', 'B');
        $ob->enqueue('email', 'b@test.io', 'S', 'B');
        $counts = $ob->counts();
        $this->assertSame(2, $counts['pending']);
        $this->assertSame(0, $counts['sent']);
    }
}

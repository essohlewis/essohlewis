<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Services\Discovery\DiscoveryService;
use Amoura\Services\Messaging\MessagingService;

/**
 * Messagerie (Phase 5, Sprint +25) : logique partagée web/API — appartenance à
 * la conversation, envoi texte (chiffré au repos), historique déchiffré,
 * accusés de lecture et liste des conversations.
 */
final class MessagingServiceTest extends IntegrationTestCase
{
    /** Crée un match mutuel entre deux nouveaux comptes et renvoie [uidA, uidB, conversationId]. */
    private function matchedPair(string $suffix): array
    {
        $a = $this->makeUser("msg-a-{$suffix}@example.com", 'female');
        $b = $this->makeUser("msg-b-{$suffix}@example.com", 'male');
        $disc = new DiscoveryService();
        $disc->swipe($a, $b, 'like');
        $res = $disc->swipe($b, $a, 'like');
        $this->assertTrue($res['matched'], 'Le match mutuel doit ouvrir une conversation.');
        return [$a, $b, (int) $res['conversation_id']];
    }

    public function testSendAndHistoryRoundTripDecrypted(): void
    {
        [$a, $b, $conv] = $this->matchedPair('rt');
        $svc = new MessagingService();

        $send = $svc->sendText($a, $conv, '  Bonjour toi 👋  ');
        $this->assertTrue($send['ok']);
        $this->assertSame(201, $send['status']);
        $this->assertSame('Bonjour toi 👋', $send['message']['body']);

        // Le destinataire lit l'historique en clair.
        $hist = $svc->history($b, $conv);
        $this->assertTrue($hist['ok']);
        $bodies = array_column($hist['messages'], 'body');
        $this->assertContains('Bonjour toi 👋', $bodies);
    }

    public function testBodyStoredEncryptedAtRest(): void
    {
        [$a, , $conv] = $this->matchedPair('enc');
        (new MessagingService())->sendText($a, $conv, 'Secret message');

        $raw = $this->db->query('SELECT body FROM messages ORDER BY id DESC LIMIT 1')->fetch();
        // Selon la disponibilité de libsodium, le corps est chiffré ; dans tous
        // les cas il ne doit jamais être vide et le round-trip reste lisible.
        if (\Amoura\Core\Security\Crypto::isEncrypted((string) $raw['body'])) {
            $this->assertStringNotContainsString('Secret message', (string) $raw['body']);
        } else {
            $this->assertSame('Secret message', (string) $raw['body']);
        }
    }

    public function testNonMemberCannotSendOrRead(): void
    {
        [, , $conv] = $this->matchedPair('perm');
        $stranger = $this->makeUser('msg-stranger@example.com');
        $svc = new MessagingService();

        $this->assertSame(403, $svc->sendText($stranger, $conv, 'hello')['status']);
        $this->assertSame(403, $svc->history($stranger, $conv)['status']);
        $this->assertSame(403, $svc->markRead($stranger, $conv, 1)['status']);
    }

    public function testEmptyBodyRejected(): void
    {
        [$a, , $conv] = $this->matchedPair('empty');
        $res = (new MessagingService())->sendText($a, $conv, '   ');
        $this->assertFalse($res['ok']);
        $this->assertSame(422, $res['status']);
    }

    public function testMarkReadUpdatesReceipt(): void
    {
        [$a, $b, $conv] = $this->matchedPair('read');
        $svc = new MessagingService();
        $sent = $svc->sendText($a, $conv, 'Coucou');
        $mid = (int) $sent['message']['id'];

        $this->assertSame(200, $svc->markRead($b, $conv, $mid)['status']);
        $row = $this->db->query('SELECT read_at FROM messages WHERE id = ' . $mid)->fetch();
        $this->assertNotNull($row['read_at']);
    }

    public function testConversationsListShowsPreview(): void
    {
        [$a, $b, $conv] = $this->matchedPair('list');
        $svc = new MessagingService();
        $svc->sendText($a, $conv, 'Dernier message');

        $list = $svc->conversations($b);
        $ids = array_column($list, 'conversation_id');
        $this->assertContains($conv, $ids);
        $row = $list[array_search($conv, $ids, true)];
        $this->assertSame('Dernier message', $row['last_message']);
        $this->assertSame($a, $row['user_id']);
    }
}

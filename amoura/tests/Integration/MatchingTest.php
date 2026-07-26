<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Conversation;
use Amoura\Models\Matching;
use Amoura\Models\Message;
use Amoura\Models\Swipe;

/**
 * Vérifie la logique métier cœur (like → match mutuel → conversation → message)
 * contre une vraie base MySQL.
 */
final class MatchingTest extends IntegrationTestCase
{
    public function testMutualLikeCreatesMatchAndConversation(): void
    {
        $alice = $this->makeUser('alice@test.io', 'female');
        $bob   = $this->makeUser('bob@test.io', 'male');
        $swipe = new Swipe();

        $first = $swipe->act($alice, $bob, 'like');
        $this->assertFalse($first['matched'], 'un like unilatéral ne crée pas de match');

        $second = $swipe->act($bob, $alice, 'like');
        $this->assertTrue($second['matched'], 'le like réciproque déclenche le match');
        $this->assertNotEmpty($second['conversation_id']);

        $this->assertTrue((new Matching())->areMatched($alice, $bob));
    }

    public function testMatchCreationIsIdempotent(): void
    {
        $a = $this->makeUser('a@test.io');
        $b = $this->makeUser('b@test.io', 'male');
        $swipe = new Swipe();
        $swipe->act($a, $b, 'like');
        $swipe->act($b, $a, 'like');
        $swipe->act($b, $a, 'like'); // répétition

        $count = (int) $this->db->query(
            'SELECT COUNT(*) FROM matches WHERE user_lo = ' . min($a, $b) . ' AND user_hi = ' . max($a, $b)
        )->fetchColumn();
        $this->assertSame(1, $count, 'une seule ligne de match doit exister');
    }

    public function testMessagingFlowAndReadReceipts(): void
    {
        $a = $this->makeUser('sender@test.io');
        $b = $this->makeUser('recipient@test.io', 'male');
        $swipe = new Swipe();
        $swipe->act($a, $b, 'like');
        $match = $swipe->act($b, $a, 'like');
        $conv = (int) $match['conversation_id'];

        $this->assertTrue((new Conversation())->isMember($conv, $a));
        $this->assertTrue((new Conversation())->isMember($conv, $b));

        $message = new Message();
        $id = $message->send($conv, $a, ['type' => 'text', 'body' => 'Bonjour']);
        $this->assertGreaterThan(0, $id);

        $history = $message->history($conv);
        $this->assertCount(1, $history);
        $this->assertSame('Bonjour', $history[0]['body']);

        $message->markReadUpTo($conv, $b, $id);
        $read = $this->db->query("SELECT read_at FROM messages WHERE id = {$id}")->fetchColumn();
        $this->assertNotNull($read, 'le message doit être marqué lu');
    }

    public function testDiscoverExcludesSwipedAndSelf(): void
    {
        $me    = $this->makeUser('me@test.io');
        $liked = $this->makeUser('liked@test.io', 'male');
        $fresh = $this->makeUser('fresh@test.io', 'male');
        (new Swipe())->act($me, $liked, 'pass');

        $ids = array_column((new Matching())->discover($me), 'id');
        $this->assertNotContains($me, $ids, 'ne doit pas se proposer soi-même');
        $this->assertNotContains($liked, $ids, 'ne doit pas reproposer un profil déjà swipé');
        $this->assertContains($fresh, $ids, 'doit proposer un profil non swipé');
    }

    public function testBlockedUsersAreHiddenFromDiscovery(): void
    {
        $me      = $this->makeUser('viewer@test.io');
        $blocked = $this->makeUser('blocked@test.io', 'male');
        $this->db->prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)')->execute([$me, $blocked]);

        $ids = array_column((new Matching())->discover($me), 'id');
        $this->assertNotContains($blocked, $ids);
    }
}

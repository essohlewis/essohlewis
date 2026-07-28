<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Services\Discovery\DiscoveryService;

/**
 * Découverte & matching (Phase 5, Sprint +24) : la logique partagée web/API —
 * vivier, validation du swipe, détection de match, quota et Super Like.
 */
final class DiscoveryServiceTest extends IntegrationTestCase
{
    public function testFeedReturnsDiscoverableCandidates(): void
    {
        $a = $this->makeUser('disc-a@example.com', 'female');
        $b = $this->makeUser('disc-b@example.com', 'male');

        $ids = array_column((new DiscoveryService())->feed($a, [], 20), 'id');
        $this->assertContains($b, array_map('intval', $ids));
        // Ne se retourne jamais soi-même.
        $this->assertNotContains($a, array_map('intval', $ids));
    }

    public function testGenderFilterNarrowsFeed(): void
    {
        $a = $this->makeUser('disc-c@example.com', 'female');
        $male = $this->makeUser('disc-d@example.com', 'male');
        $female = $this->makeUser('disc-e@example.com', 'female');

        $ids = array_map('intval', array_column((new DiscoveryService())->feed($a, ['gender' => 'male'], 20), 'id'));
        $this->assertContains($male, $ids);
        $this->assertNotContains($female, $ids);
    }

    public function testInvalidActionRejected(): void
    {
        $a = $this->makeUser('disc-f@example.com');
        $b = $this->makeUser('disc-g@example.com');
        $svc = new DiscoveryService();

        $this->assertSame(422, $svc->swipe($a, $b, 'wink')['status']);
        $this->assertSame(422, $svc->swipe($a, 0, 'like')['status']);
        // Pas de swipe sur soi-même.
        $this->assertSame(422, $svc->swipe($a, $a, 'like')['status']);
    }

    public function testMutualLikeCreatesMatch(): void
    {
        $a = $this->makeUser('disc-h@example.com', 'female');
        $b = $this->makeUser('disc-i@example.com', 'male');
        $svc = new DiscoveryService();

        $first = $svc->swipe($a, $b, 'like');
        $this->assertTrue($first['ok']);
        $this->assertFalse($first['matched']);

        $second = $svc->swipe($b, $a, 'like');
        $this->assertTrue($second['matched']);
        $this->assertNotNull($second['conversation_id']);
    }

    public function testSuperlikeWithoutCreditReturnsStoreFlag(): void
    {
        $a = $this->makeUser('disc-j@example.com', 'female');
        $b = $this->makeUser('disc-k@example.com', 'male');

        $res = (new DiscoveryService())->swipe($a, $b, 'superlike');
        $this->assertFalse($res['ok']);
        $this->assertSame(402, $res['status']);
        $this->assertTrue($res['flags']['store'] ?? false);
    }

    public function testFreeDailyLikeQuotaEnforced(): void
    {
        $a = $this->makeUser('disc-quota@example.com', 'female');
        $svc = new DiscoveryService();

        // Épuise le quota gratuit avec des cibles distinctes.
        for ($i = 0; $i < DiscoveryService::FREE_DAILY_LIKES; $i++) {
            $target = $this->makeUser("disc-t{$i}@example.com", 'male');
            $this->assertTrue($svc->swipe($a, $target, 'like')['ok']);
        }
        // Le like suivant est bloqué avec l'indice d'upgrade.
        $extra = $this->makeUser('disc-over@example.com', 'male');
        $res = $svc->swipe($a, $extra, 'like');
        $this->assertFalse($res['ok']);
        $this->assertSame(402, $res['status']);
        $this->assertTrue($res['flags']['upgrade'] ?? false);
    }
}

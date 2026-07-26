<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\ProfileView;
use Amoura\Models\PushSubscription;

/**
 * Sprint +2 : visites de profil (« qui a vu mon profil ») et abonnements Web Push.
 */
final class EngagementTest extends IntegrationTestCase
{
    public function testProfileViewRecordsAndAggregates(): void
    {
        $owner = $this->makeUser('owner@test.io');
        $visitor = $this->makeUser('visitor@test.io', 'male');
        $pv = new ProfileView();

        $pv->record($owner, $visitor);
        $pv->record($owner, $visitor); // 2e visite → incrémente le compteur

        $viewers = $pv->viewers($owner);
        $this->assertCount(1, $viewers);
        $this->assertSame($visitor, (int) $viewers[0]['id']);
        $this->assertSame(2, (int) $viewers[0]['views']);
        $this->assertSame(1, $pv->countFor($owner));
    }

    public function testSelfViewIsIgnored(): void
    {
        $u = $this->makeUser('solo@test.io');
        (new ProfileView())->record($u, $u);
        $this->assertSame(0, (new ProfileView())->countFor($u));
    }

    public function testBlockedVisitorHiddenFromViewers(): void
    {
        $owner = $this->makeUser('owner2@test.io');
        $blocked = $this->makeUser('creep@test.io', 'male');
        (new ProfileView())->record($owner, $blocked);
        $this->db->prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)')->execute([$owner, $blocked]);

        $this->assertCount(0, (new ProfileView())->viewers($owner));
    }

    public function testPushSubscriptionStoreIsIdempotentByEndpoint(): void
    {
        $u = $this->makeUser('pushuser@test.io');
        $subs = new PushSubscription();
        $subs->store($u, 'https://push.example/abc', 'key1', 'auth1', 'UA');
        $subs->store($u, 'https://push.example/abc', 'key2', 'auth2', 'UA'); // même endpoint → upsert

        $rows = $subs->forUser($u);
        $this->assertCount(1, $rows);
        $this->assertSame('key2', $rows[0]['p256dh']);

        $subs->deleteByEndpoint('https://push.example/abc');
        $this->assertCount(0, $subs->forUser($u));
    }
}

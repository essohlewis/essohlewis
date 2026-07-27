<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Event;

/** Événements : inscription, capacité, liste d'attente, promotion (Phase 5, Sprint +17). */
final class EventTest extends IntegrationTestCase
{
    /** Crée un événement publié avec la capacité donnée. */
    private function makeEvent(?int $capacity, string $slug = 'evt'): int
    {
        $this->db->prepare(
            "INSERT INTO events (title, slug, type, capacity, starts_at, status)
             VALUES ('Test', ?, 'meetup', ?, DATE_ADD(NOW(), INTERVAL 3 DAY), 'published')"
        )->execute([$slug, $capacity]);
        return (int) $this->db->lastInsertId();
    }

    public function testJoinConfirmsWhenSpaceAvailable(): void
    {
        $event = new Event();
        $id = $this->makeEvent(2);
        $u = $this->makeUser('a@test.io');

        $this->assertSame('going', $event->join($id, $u));
        $this->assertSame('going', $event->attendeeStatus($id, $u));
        // Idempotent : ré-inscription ne duplique pas ni ne change le statut.
        $this->assertSame('going', $event->join($id, $u));
        $count = (int) $this->db->query("SELECT COUNT(*) FROM event_attendees WHERE event_id = {$id}")->fetchColumn();
        $this->assertSame(1, $count);
    }

    public function testWaitlistWhenFull(): void
    {
        $event = new Event();
        $id = $this->makeEvent(1);
        $a = $this->makeUser('a@test.io');
        $b = $this->makeUser('b@test.io', 'male');

        $this->assertSame('going', $event->join($id, $a));
        $this->assertSame('waitlist', $event->join($id, $b), 'capacité atteinte → liste d\'attente');
    }

    public function testLeavePromotesFirstWaitlisted(): void
    {
        $event = new Event();
        $id = $this->makeEvent(1);
        $a = $this->makeUser('a@test.io');
        $b = $this->makeUser('b@test.io', 'male');
        $c = $this->makeUser('c@test.io', 'male');

        $event->join($id, $a);            // going
        $event->join($id, $b);            // waitlist (1er)
        $event->join($id, $c);            // waitlist (2e)

        $result = $event->leave($id, $a);
        $this->assertTrue($result['left']);
        $this->assertSame($b, $result['promoted_user_id'], 'le plus ancien en attente est promu');
        $this->assertSame('going', $event->attendeeStatus($id, $b));
        $this->assertSame('waitlist', $event->attendeeStatus($id, $c), 'le suivant reste en attente');
        $this->assertSame('canceled', $event->attendeeStatus($id, $a));
    }

    public function testUnlimitedCapacityAlwaysGoing(): void
    {
        $event = new Event();
        $id = $this->makeEvent(null);
        foreach (range(1, 5) as $i) {
            $this->assertSame('going', $event->join($id, $this->makeUser("u{$i}@test.io", 'male')));
        }
    }

    public function testCannotJoinUnpublishedOrPastEvent(): void
    {
        $event = new Event();
        // Passé.
        $this->db->prepare("INSERT INTO events (title, slug, type, starts_at, status)
                            VALUES ('Passé', 'passe', 'meetup', DATE_SUB(NOW(), INTERVAL 1 DAY), 'published')")->execute();
        $pastId = (int) $this->db->lastInsertId();
        $u = $this->makeUser('a@test.io');
        $this->assertNull($event->join($pastId, $u), 'pas d\'inscription à un événement passé');

        // Brouillon.
        $this->db->prepare("INSERT INTO events (title, slug, type, starts_at, status)
                            VALUES ('Brouillon', 'brouillon', 'meetup', DATE_ADD(NOW(), INTERVAL 2 DAY), 'draft')")->execute();
        $draftId = (int) $this->db->lastInsertId();
        $this->assertNull($event->join($draftId, $u));
    }

    public function testUpcomingListsOnlyPublishedFuture(): void
    {
        $this->makeEvent(10, 'futur');
        $upcoming = (new Event())->upcoming();
        $slugs = array_column($upcoming, 'slug');
        $this->assertContains('futur', $slugs);
    }
}

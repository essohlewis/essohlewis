<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Paginator;
use Amoura\Models\Notification;

/**
 * Notifications mobiles (Phase 5, Sprint +27) : chemin de données exposé par
 * l'API — liste paginée par curseur, compteur de non-lus, marquage « tout lu ».
 */
final class NotificationApiTest extends IntegrationTestCase
{
    public function testUnreadCountAndMarkAllRead(): void
    {
        $uid = $this->makeUser('notif-a@example.com');
        $actor = $this->makeUser('notif-actor@example.com');
        $model = new Notification();
        $model->push($uid, 'like', $actor);
        $model->push($uid, 'message', $actor, ['conversation_id' => 1], 'conversation', 1);

        $this->assertSame(2, $model->unreadCount($uid));

        $model->markAllRead($uid);
        $this->assertSame(0, $model->unreadCount($uid));
    }

    public function testCursorPaginationReturnsNextCursor(): void
    {
        $uid = $this->makeUser('notif-b@example.com');
        $actor = $this->makeUser('notif-actor2@example.com');
        $model = new Notification();
        for ($i = 0; $i < 35; $i++) {
            $model->push($uid, 'like', $actor);
        }

        // Première page (comme le contrôleur : limite 30 + détection de suite).
        $rows = $model->forUser($uid, 30, 0);
        $page = Paginator::page($rows, 30, static fn(array $n): int => (int) $n['id']);
        $this->assertCount(30, $page['data']);
        $this->assertNotNull($page['next_cursor'], 'Une page suivante doit être signalée.');

        // Page suivante via le curseur décodé.
        $before = Paginator::decode($page['next_cursor']);
        $this->assertGreaterThan(0, $before);
        $rows2 = $model->forUser($uid, 30, $before);
        $page2 = Paginator::page($rows2, 30, static fn(array $n): int => (int) $n['id']);
        $this->assertCount(5, $page2['data']);
        $this->assertNull($page2['next_cursor']);
    }

    public function testForUserIncludesActorProjectionFields(): void
    {
        $uid = $this->makeUser('notif-c@example.com');
        $actor = $this->makeUser('notif-actor3@example.com');
        (new Notification())->push($uid, 'match', $actor, ['conversation_id' => 7], 'conversation', 7);

        $rows = (new Notification())->forUser($uid, 30, 0);
        $this->assertNotEmpty($rows);
        $n = $rows[0];
        // Champs utilisés par la projection API.
        $this->assertSame('match', $n['type']);
        $this->assertSame($actor, (int) $n['actor_id']);
        $this->assertArrayHasKey('actor_name', $n);
        $this->assertSame(['conversation_id' => 7], json_decode((string) $n['data'], true));
    }
}

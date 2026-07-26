<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Services\Billing\Dunning;

/**
 * Sprint +5 : machine à états des relances d'abonnement (dunning).
 */
final class DunningTest extends IntegrationTestCase
{
    private function makeSubscription(int $userId, string $status, string $periodEndSql): int
    {
        $this->db->prepare(
            'INSERT INTO subscriptions (user_id, plan_id, status, gateway, started_at, current_period_end)
             VALUES (?, 2, ?, "stripe", NOW(), ' . $periodEndSql . ')'
        )->execute([$userId, $status]);
        return (int) $this->db->lastInsertId();
    }

    public function testReminderSentForSubscriptionExpiringSoon(): void
    {
        $uid = $this->makeUser('soon@test.io');
        $id = $this->makeSubscription($uid, 'active', 'DATE_ADD(NOW(), INTERVAL 2 DAY)');

        $counts = Dunning::run();
        $this->assertSame(1, $counts['reminded']);

        $row = $this->db->query("SELECT status, reminder_sent_at FROM subscriptions WHERE id={$id}")->fetch();
        $this->assertSame('active', $row['status'], 'reste actif, juste relancé');
        $this->assertNotNull($row['reminder_sent_at']);

        // Un second passage ne relance pas (reminder_sent_at déjà posé).
        $this->assertSame(0, Dunning::run()['reminded']);
    }

    public function testOverdueSubscriptionBecomesPastDue(): void
    {
        $uid = $this->makeUser('overdue@test.io');
        $id = $this->makeSubscription($uid, 'active', 'DATE_SUB(NOW(), INTERVAL 1 DAY)');

        $counts = Dunning::run();
        $this->assertSame(1, $counts['past_due']);
        $this->assertSame('past_due', $this->db->query("SELECT status FROM subscriptions WHERE id={$id}")->fetchColumn());
    }

    public function testPastDueBecomesExpiredAfterGrace(): void
    {
        $uid = $this->makeUser('grace@test.io');
        $id = $this->makeSubscription($uid, 'past_due', 'DATE_SUB(NOW(), INTERVAL 5 DAY)');

        $counts = Dunning::run();
        $this->assertSame(1, $counts['expired']);
        $this->assertSame('expired', $this->db->query("SELECT status FROM subscriptions WHERE id={$id}")->fetchColumn());
    }

    public function testLifetimeSubscriptionsAreNeverDunned(): void
    {
        $uid = $this->makeUser('lifetime@test.io');
        $this->makeSubscription($uid, 'active', 'NULL'); // current_period_end NULL = à vie
        $counts = Dunning::run();
        $this->assertSame(['reminded' => 0, 'past_due' => 0, 'expired' => 0], $counts);
    }
}

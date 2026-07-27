<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Plan;
use Amoura\Models\Subscription;
use Amoura\Models\Transaction;
use Amoura\Services\Analytics\RevenueAnalytics;

/** Tableau de bord revenus : MRR, ARPU, churn, tendance (Phase 3, Sprint +11). */
final class RevenueAnalyticsTest extends IntegrationTestCase
{
    private function paidTx(int $user, int $planId, int $cents, string $gateway): void
    {
        $tx = new Transaction();
        $id = $tx->initiate($user, $planId, $cents, 'XOF', $gateway);
        $tx->markPaid($id, $gateway . '-' . $id);
    }

    public function testSummaryAndMrr(): void
    {
        $vip = (new Plan())->bySlug('vip');
        $prem = (new Plan())->bySlug('premium');
        $u1 = $this->makeUser('rev1@test.io');
        $u2 = $this->makeUser('rev2@test.io', 'male');

        $this->paidTx($u1, (int) $vip['id'], (int) $vip['price_cents'], 'stripe');
        $this->paidTx($u2, (int) $prem['id'], (int) $prem['price_cents'], 'cinetpay');
        // Abonnement VIP actif (mensuel) → MRR = prix VIP.
        (new Subscription())->activate($u1, (int) $vip['id'], 'stripe', 'S1', 'month');

        $s = RevenueAnalytics::summary();
        $this->assertSame((int) $vip['price_cents'] + (int) $prem['price_cents'], $s['total_cents']);
        $this->assertSame(2, $s['paid_count']);
        $this->assertSame(2, $s['payers']);
        $this->assertSame(1, $s['active_subscribers']);
        $this->assertSame((int) $vip['price_cents'], $s['mrr_cents'], 'MRR = prix mensuel VIP');
        $this->assertSame($s['mrr_cents'], $s['arpu_cents'], 'un seul abonné → ARPU = MRR');
        $this->assertGreaterThan(0, $s['ltv_cents']);
    }

    public function testYearlyPlanMrrIsNormalizedMonthly(): void
    {
        // Offre annuelle dédiée (les offres du seed sont mensuelles).
        $this->db->exec(
            "INSERT INTO plans (slug, name, description, price_cents, currency, `interval`, features, position)
             VALUES ('vip-annual','VIP Annuel','', 1200000, 'XOF', 'year', JSON_OBJECT('badge',true), 9)"
        );
        $planId = (int) $this->db->query("SELECT id FROM plans WHERE slug='vip-annual'")->fetchColumn();
        $u = $this->makeUser('yearly@test.io');
        (new Subscription())->activate($u, $planId, 'stripe', 'Y1', 'year');

        $s = RevenueAnalytics::summary();
        // Un abonnement annuel contribue au MRR à hauteur de 1/12 du prix.
        $this->assertEqualsWithDelta(1200000 / 12, $s['mrr_cents'], 1.0);
    }

    public function testMonthlyTrendHasTwelveConsecutiveMonths(): void
    {
        $prem = (new Plan())->bySlug('premium');
        $u = $this->makeUser('trend@test.io');
        $this->paidTx($u, (int) $prem['id'], 350000, 'stripe');

        $trend = RevenueAnalytics::monthlyTrend(12);
        $this->assertCount(12, $trend);
        // Le dernier point = mois courant, avec le revenu encaissé ce mois.
        $last = $trend[11];
        $this->assertSame(date('Y-m'), $last['month']);
        $this->assertSame(350000, $last['cents']);
    }

    public function testBreakdowns(): void
    {
        $prem = (new Plan())->bySlug('premium');
        $u = $this->makeUser('brk@test.io');
        $this->paidTx($u, (int) $prem['id'], 350000, 'paypal');

        $byGw = RevenueAnalytics::byGateway();
        $this->assertNotEmpty($byGw);
        $this->assertSame('paypal', $byGw[0]['gateway']);

        $byPlan = RevenueAnalytics::byPlan();
        $this->assertSame('Premium', $byPlan[0]['plan']);
    }
}

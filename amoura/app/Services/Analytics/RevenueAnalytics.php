<?php
declare(strict_types=1);

namespace Amoura\Services\Analytics;

use Amoura\Core\Database;

/**
 * Analytique des revenus pour l'admin (Phase 3) : MRR, ARPU, LTV, churn,
 * tendance mensuelle, répartition par prestataire et par offre.
 * Agrégations SQL en lecture (réplica si disponible).
 */
final class RevenueAnalytics
{
    /** Indicateurs clés consolidés (montants en centimes). */
    public static function summary(): array
    {
        $db = Database::read();
        $one = fn(string $sql): int => (int) $db->query($sql)->fetchColumn();

        $total = $one('SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE status="paid"');
        $month = $one('SELECT COALESCE(SUM(amount_cents),0) FROM transactions
                       WHERE status="paid" AND paid_at >= DATE_FORMAT(NOW(),"%Y-%m-01")');
        $paidCount = $one('SELECT COUNT(*) FROM transactions WHERE status="paid"');
        $payers = $one('SELECT COUNT(DISTINCT user_id) FROM transactions WHERE status="paid"');
        $activeSubs = $one('SELECT COUNT(*) FROM subscriptions
                            WHERE status="active" AND (current_period_end IS NULL OR current_period_end > NOW())');

        // MRR : prix de chaque abonnement actif normalisé au mois.
        $mrr = $one(
            'SELECT COALESCE(SUM(
                CASE p.`interval`
                    WHEN "year" THEN p.price_cents/12
                    WHEN "lifetime" THEN 0
                    ELSE p.price_cents
                END),0)
             FROM subscriptions s JOIN plans p ON p.id = s.plan_id
             WHERE s.status="active" AND (s.current_period_end IS NULL OR s.current_period_end > NOW())'
        );

        // Churn mensuel : abonnements résiliés/expirés sur 30 j / base concernée.
        $churned = $one('SELECT COUNT(*) FROM subscriptions
                         WHERE status IN ("canceled","expired")
                           AND COALESCE(canceled_at, current_period_end) >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
        $churnBase = max(1, $activeSubs + $churned);
        $churnRate = $churned / $churnBase;

        $arpu = $activeSubs > 0 ? (int) round($mrr / $activeSubs) : 0;         // revenu mensuel moyen / abonné
        // LTV ≈ ARPU / churn (plafonné à 24 mois si churn négligeable).
        $ltv = $churnRate > 0 ? (int) round($arpu / $churnRate) : $arpu * 24;

        return [
            'total_cents' => $total,
            'month_cents' => $month,
            'paid_count' => $paidCount,
            'payers' => $payers,
            'active_subscribers' => $activeSubs,
            'mrr_cents' => $mrr,
            'arpu_cents' => $arpu,
            'ltv_cents' => $ltv,
            'churn_rate' => round($churnRate, 4),
        ];
    }

    /**
     * Revenu par mois sur les N derniers mois (mois manquants comblés à 0).
     * @return array<int,array{month:string,cents:int,count:int}>
     */
    public static function monthlyTrend(int $months = 12): array
    {
        $months = max(1, min(36, $months));
        $db = Database::read();
        $st = $db->prepare(
            'SELECT DATE_FORMAT(paid_at,"%Y-%m") AS ym, SUM(amount_cents) AS cents, COUNT(*) AS n
             FROM transactions
             WHERE status="paid" AND paid_at >= DATE_SUB(DATE_FORMAT(NOW(),"%Y-%m-01"), INTERVAL ? MONTH)
             GROUP BY ym'
        );
        $st->execute([$months - 1]);
        $byMonth = [];
        foreach ($st->fetchAll() as $r) {
            $byMonth[$r['ym']] = ['cents' => (int) $r['cents'], 'count' => (int) $r['n']];
        }

        // Comble la série pour obtenir exactement N mois consécutifs.
        $series = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $ym = date('Y-m', strtotime("first day of -{$i} month"));
            $series[] = [
                'month' => $ym,
                'cents' => $byMonth[$ym]['cents'] ?? 0,
                'count' => $byMonth[$ym]['count'] ?? 0,
            ];
        }
        return $series;
    }

    /** Revenu payé réparti par prestataire de paiement. */
    public static function byGateway(): array
    {
        return Database::read()->query(
            'SELECT gateway, SUM(amount_cents) AS cents, COUNT(*) AS n
             FROM transactions WHERE status="paid"
             GROUP BY gateway ORDER BY cents DESC'
        )->fetchAll();
    }

    /** Revenu payé réparti par offre (abonnements). */
    public static function byPlan(): array
    {
        return Database::read()->query(
            'SELECT p.name AS plan, SUM(t.amount_cents) AS cents, COUNT(*) AS n
             FROM transactions t JOIN plans p ON p.id = t.plan_id
             WHERE t.status="paid"
             GROUP BY p.id ORDER BY cents DESC'
        )->fetchAll();
    }
}

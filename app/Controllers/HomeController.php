<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use PDO;
use Transouscris\Core\Controller;
use Transouscris\Core\Database;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\Recharge;

/**
 * Pages publiques et tableau de bord analytique de l'utilisateur.
 */
final class HomeController extends Controller
{
    public function landing(Request $request): Response
    {
        return $this->view('home.landing', ['title' => 'Transouscris — Recharge mobile & forfaits'], layout: 'layouts.public');
    }

    public function dashboard(Request $request): Response
    {
        $user   = $this->requireUser();
        $wallet = $user->wallet();

        return $this->view('home.dashboard', [
            'title'   => 'Tableau de bord',
            'wallet'  => $wallet,
            'recent'  => Recharge::forUser($user->id, 8),
            'stats'   => $this->stats($user->id),
        ]);
    }

    /**
     * Statistiques et séries pour les graphiques du tableau de bord.
     * Les « dépenses » excluent les recharges remboursées.
     */
    private function stats(int $userId): array
    {
        $pdo = Database::connection();
        $one = static function (string $sql, array $p) use ($pdo) {
            $s = $pdo->prepare($sql);
            $s->execute($p);
            return $s->fetch();
        };

        $totalTx = (int) ($one('SELECT COUNT(*) c FROM recharges WHERE user_id = :u', ['u' => $userId])['c'] ?? 0);
        $totalAmount = (int) ($one("SELECT COALESCE(SUM(amount),0) s FROM recharges WHERE user_id = :u AND status <> 'refunded'", ['u' => $userId])['s'] ?? 0);
        $monthSpend = (int) ($one(
            "SELECT COALESCE(SUM(amount),0) s FROM recharges
             WHERE user_id = :u AND status <> 'refunded'
               AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')",
            ['u' => $userId]
        )['s'] ?? 0);

        $topOperator = $one(
            'SELECT operator_code, COUNT(*) c FROM recharges WHERE user_id = :u
             GROUP BY operator_code ORDER BY c DESC LIMIT 1',
            ['u' => $userId]
        );
        $topType = $one(
            'SELECT type, COUNT(*) c FROM recharges WHERE user_id = :u
             GROUP BY type ORDER BY c DESC LIMIT 1',
            ['u' => $userId]
        );

        // Série : dépenses des 7 derniers jours (jours vides inclus).
        $rows = $pdo->prepare(
            "SELECT DATE(created_at) d, COALESCE(SUM(amount),0) s
             FROM recharges
             WHERE user_id = :u AND status <> 'refunded'
               AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(created_at)"
        );
        $rows->execute(['u' => $userId]);
        $byDay = [];
        foreach ($rows->fetchAll() as $r) {
            $byDay[$r['d']] = (int) $r['s'];
        }
        $daily = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = date('Y-m-d', strtotime("-$i day"));
            $daily[] = ['label' => date('d/m', strtotime($day)), 'value' => $byDay[$day] ?? 0];
        }

        // Répartition par réseau.
        $opRows = $pdo->prepare(
            'SELECT operator_code, COUNT(*) c, COALESCE(SUM(amount),0) s
             FROM recharges WHERE user_id = :u GROUP BY operator_code ORDER BY c DESC'
        );
        $opRows->execute(['u' => $userId]);
        $byOperator = $opRows->fetchAll();

        // Recommandations : opérations les plus fréquentes.
        $recoRows = $pdo->prepare(
            'SELECT operator_code, type, plan_id, amount, COUNT(*) c
             FROM recharges WHERE user_id = :u
             GROUP BY operator_code, type, plan_id, amount
             ORDER BY c DESC LIMIT 3'
        );
        $recoRows->execute(['u' => $userId]);

        return [
            'total_tx'     => $totalTx,
            'total_amount' => $totalAmount,
            'month_spend'  => $monthSpend,
            'top_operator' => $topOperator['operator_code'] ?? null,
            'top_type'     => $topType['type'] ?? null,
            'last'         => Recharge::forUser($userId, 1)[0] ?? null,
            'daily'        => $daily,
            'by_operator'  => $byOperator,
            'reco'         => $recoRows->fetchAll(),
        ];
    }
}

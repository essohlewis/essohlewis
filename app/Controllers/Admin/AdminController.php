<?php

declare(strict_types=1);

namespace Transouscris\Controllers\Admin;

use Transouscris\Core\Controller;
use Transouscris\Core\Database;
use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Back-office administrateur : statistiques, transactions, agents, litiges.
 * L'accès est gardé par AdminMiddleware (rôle admin obligatoire).
 */
final class AdminController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $pdo = Database::connection();

        $stats = [
            'users'          => (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
            'agents'         => (int) $pdo->query('SELECT COUNT(*) FROM agents')->fetchColumn(),
            'recharges_ok'   => (int) $pdo->query("SELECT COUNT(*) FROM recharges WHERE status = 'success'")->fetchColumn(),
            'recharges_pend' => (int) $pdo->query("SELECT COUNT(*) FROM recharges WHERE status IN ('pending','dispatched')")->fetchColumn(),
            'volume_xof'     => (int) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM recharges WHERE status = 'success'")->fetchColumn(),
            'wallet_total'   => (int) $pdo->query("SELECT COALESCE(SUM(balance),0) FROM ledger_accounts WHERE owner_type = 'user'")->fetchColumn(),
        ];

        // Contrôle d'intégrité comptable : la somme de TOUS les soldes doit être nulle.
        $stats['ledger_balance_check'] = (int) $pdo->query('SELECT COALESCE(SUM(balance),0) FROM ledger_accounts')->fetchColumn();

        return $this->view('admin.dashboard', ['title' => 'Administration', 'stats' => $stats], layout: 'layouts.admin');
    }

    public function transactions(Request $request): Response
    {
        $rows = Database::connection()->query(
            'SELECT t.id, t.reference, t.type, t.status, t.created_at,
                    COALESCE(SUM(CASE WHEN e.direction = \'debit\' THEN e.amount ELSE 0 END),0) AS total
             FROM ledger_transactions t
             LEFT JOIN ledger_entries e ON e.ledger_transaction_id = t.id
             GROUP BY t.id
             ORDER BY t.id DESC LIMIT 100'
        )->fetchAll();

        return $this->view('admin.transactions', ['title' => 'Transactions', 'rows' => $rows], layout: 'layouts.admin');
    }

    public function agents(Request $request): Response
    {
        $rows = Database::connection()->query(
            'SELECT a.*, u.phone FROM agents a JOIN users u ON u.id = a.user_id ORDER BY a.reliability_score DESC'
        )->fetchAll();
        return $this->view('admin.agents', ['title' => 'Agents', 'rows' => $rows], layout: 'layouts.admin');
    }
}

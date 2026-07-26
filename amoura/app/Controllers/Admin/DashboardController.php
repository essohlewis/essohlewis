<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Database;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Auth;
use Amoura\Models\ActivityLog;
use Amoura\Models\Notification;
use Amoura\Models\Report;
use Amoura\Models\Transaction;
use Amoura\Models\User;

final class DashboardController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'dashboard.view');
        $db = Database::connection();
        $count = fn(string $sql) => (int) $db->query($sql)->fetchColumn();

        $revenue = (new Transaction())->revenueStats();
        $this->view('admin/dashboard', [
            'users' => (new User())->adminStats(),
            'matches_total' => $count('SELECT COUNT(*) FROM matches WHERE status = "active"'),
            'messages_total' => $count('SELECT COUNT(*) FROM messages'),
            'messages_today' => $count('SELECT COUNT(*) FROM messages WHERE DATE(created_at) = CURDATE()'),
            'calls_total' => $count('SELECT COUNT(*) FROM calls'),
            'active_subs' => $count('SELECT COUNT(*) FROM subscriptions WHERE status = "active"'),
            'revenue' => $revenue,
            'open_reports' => (new Report())->openCount(),
            'signups_series' => $this->signupSeries(),
        ], 'layouts/admin');
    }

    /** Série d'inscriptions des 14 derniers jours (pour le graphe). */
    private function signupSeries(): array
    {
        $rows = Database::connection()->query(
            'SELECT DATE(created_at) d, COUNT(*) c FROM users
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
             GROUP BY DATE(created_at) ORDER BY d'
        )->fetchAll();
        $map = [];
        foreach ($rows as $r) {
            $map[$r['d']] = (int) $r['c'];
        }
        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $day = date('Y-m-d', strtotime("-{$i} days"));
            $series[] = ['date' => date('d/m', strtotime($day)), 'count' => $map[$day] ?? 0];
        }
        return $series;
    }

    /** Notification de masse / newsletter (super-admin & gestionnaire). */
    public function broadcast(Request $request): void
    {
        $staff = $this->requirePermission($request, 'dashboard.view');
        $message = trim((string) $request->input('message'));
        if ($message === '') {
            Session::flash('error', 'Message vide.');
            $this->redirect('/admin');
        }
        // Insertion en masse d'une notification « system » pour tous les actifs.
        Database::connection()->exec(
            'INSERT INTO notifications (user_id, type, data)
             SELECT id, "system", ' . Database::connection()->quote(json_encode(['message' => $message])) . '
             FROM users WHERE status = "active"'
        );
        (new ActivityLog())->record((int) $staff['id'], 'broadcast.sent', null, null, ['len' => strlen($message)], $request->ip());
        Session::flash('success', 'Notification envoyée à tous les membres actifs.');
        $this->redirect('/admin');
    }
}

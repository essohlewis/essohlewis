<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Database;
use App\Core\Request;

final class UserAdminController extends AdminController
{
    /** GET /admin/users */
    public function index(Request $request): void
    {
        $this->requireAdmin();
        $db = Database::connection();
        $users = $db->query(
            'SELECT u.id, u.phone, u.display_name, u.status, u.phone_verified, u.created_at,
                    (SELECT COUNT(*) FROM child_profiles c WHERE c.user_id = u.id) AS children,
                    (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.status="active") AS active_subs
             FROM users u ORDER BY u.created_at DESC LIMIT 100'
        )->fetchAll();
        $this->view('users', ['users' => $users, 'active' => 'users']);
    }

    /** GET /admin/payments */
    public function payments(Request $request): void
    {
        $this->requireAdmin();
        $db = Database::connection();
        $rows = $db->query(
            'SELECT p.*, u.phone FROM payments p JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC LIMIT 100'
        )->fetchAll();
        $this->view('payments', ['payments' => $rows, 'active' => 'payments']);
    }
}

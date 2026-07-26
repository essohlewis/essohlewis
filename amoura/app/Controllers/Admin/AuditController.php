<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\ActivityLog;

/** Consultation du journal d'audit. */
final class AuditController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'dashboard.view');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 50;
        $this->view('admin/audit', [
            'logs' => (new ActivityLog())->recent($perPage, ($page - 1) * $perPage),
            'page' => $page,
        ], 'layouts/admin');
    }
}

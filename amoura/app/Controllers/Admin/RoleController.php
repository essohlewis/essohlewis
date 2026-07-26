<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Database;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;

/** Gestion des rôles et permissions (réservée au super-admin). */
final class RoleController extends Controller
{
    /** Catalogue des permissions attribuables. */
    private const PERMISSIONS = [
        'dashboard.view', 'members.view', 'members.suspend', 'members.verify',
        'moderation.review', 'moderation.action', 'reports.view',
        'subscriptions.manage', 'settings.view', 'settings.update', 'cms.manage', 'roles.manage',
    ];

    public function index(Request $request): void
    {
        $this->requirePermission($request, 'roles.manage');
        $roles = Database::connection()->query('SELECT * FROM roles ORDER BY id')->fetchAll();
        $this->view('admin/roles', [
            'roles' => $roles,
            'permissions' => self::PERMISSIONS,
        ], 'layouts/admin');
    }

    public function update(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'roles.manage');
        $id = (int) $params['id'];
        $selected = array_values(array_intersect(
            self::PERMISSIONS,
            (array) $request->input('permissions', [])
        ));
        Database::connection()->prepare('UPDATE roles SET permissions = ? WHERE id = ?')
            ->execute([json_encode($selected), $id]);
        (new ActivityLog())->record((int) $staff['id'], 'role.update', 'role', $id, ['permissions' => $selected], $request->ip());
        Session::flash('success', 'Permissions du rôle mises à jour.');
        $this->redirect('/admin/roles');
    }
}

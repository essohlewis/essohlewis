<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;
use Amoura\Models\Photo;
use Amoura\Models\User;

final class MemberController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'members.view');
        $term = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 25;

        $this->view('admin/members', [
            'members' => (new User())->search($term, $status, $perPage, ($page - 1) * $perPage),
            'q' => $term,
            'status' => $status,
            'page' => $page,
        ], 'layouts/admin');
    }

    public function show(Request $request, array $params): void
    {
        $this->requirePermission($request, 'members.view');
        $id = (int) $params['id'];
        $this->view('admin/member_detail', [
            'member' => (new User())->fullProfile($id),
            'raw' => (new User())->find($id),
            'photos' => (new Photo())->forUser($id),
        ], 'layouts/admin');
    }

    /** Suspendre / bannir / réactiver / supprimer un membre. */
    public function setStatus(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'members.suspend');
        $id = (int) $params['id'];
        $status = (string) $request->input('status');
        $reason = (string) $request->input('reason', '');

        if (!in_array($status, ['active', 'suspended', 'banned', 'deleted'], true)) {
            Session::flash('error', 'Statut invalide.');
            $this->redirect('/admin/members/' . $id);
        }

        $data = ['status' => $status, 'ban_reason' => $status === 'banned' ? $reason : null];
        if ($status === 'suspended') {
            $days = max(1, (int) $request->input('days', 7));
            $data['suspended_until'] = date('Y-m-d H:i:s', strtotime("+{$days} days"));
        }
        (new User())->update($id, $data);
        (new ActivityLog())->record((int) $staff['id'], 'member.status', 'user', $id, ['status' => $status, 'reason' => $reason], $request->ip());

        Session::flash('success', "Membre mis à jour ({$status}).");
        $this->redirect('/admin/members/' . $id);
    }

    public function verify(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'members.verify');
        $id = (int) $params['id'];
        $verified = $request->input('verified') ? 1 : 0;
        (new User())->update($id, ['is_verified' => $verified]);
        (new ActivityLog())->record((int) $staff['id'], 'member.verify', 'user', $id, ['verified' => $verified], $request->ip());
        Session::flash('success', $verified ? 'Profil vérifié.' : 'Vérification retirée.');
        $this->redirect('/admin/members/' . $id);
    }
}

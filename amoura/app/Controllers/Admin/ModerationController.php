<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;
use Amoura\Models\Photo;
use Amoura\Models\Report;

final class ModerationController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'moderation.review');
        $this->view('admin/moderation', [
            'reports' => (new Report())->queue('open'),
            'photos' => (new Photo())->pendingModeration(),
        ], 'layouts/admin');
    }

    public function resolve(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'moderation.action');
        $status = (string) $request->input('status');
        if (!in_array($status, ['actioned', 'dismissed', 'reviewing'], true)) {
            Session::flash('error', 'Statut invalide.');
            $this->redirect('/admin/moderation');
        }
        (new Report())->resolve((int) $params['id'], (int) $staff['id'], $status);
        (new ActivityLog())->record((int) $staff['id'], 'report.resolve', 'report', (int) $params['id'], ['status' => $status], $request->ip());
        Session::flash('success', 'Signalement traité.');
        $this->redirect('/admin/moderation');
    }

    /** Approuve ou rejette une photo en attente. */
    public function photo(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'moderation.action');
        $decision = (string) $request->input('decision');
        if (!in_array($decision, ['approved', 'rejected'], true)) {
            Session::flash('error', 'Décision invalide.');
            $this->redirect('/admin/moderation');
        }
        (new Photo())->update((int) $params['id'], ['moderation' => $decision]);
        (new ActivityLog())->record((int) $staff['id'], 'photo.moderate', 'photo', (int) $params['id'], ['decision' => $decision], $request->ip());
        Session::flash('success', 'Photo ' . ($decision === 'approved' ? 'approuvée' : 'rejetée') . '.');
        $this->redirect('/admin/moderation');
    }
}

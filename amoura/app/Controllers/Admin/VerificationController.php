<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;
use Amoura\Models\Notification;
use Amoura\Models\Verification;

/**
 * File de revue des vérifications de profil (Phase 4, Sprint +10).
 * Le staff approuve (→ badge vérifié) ou rejette les demandes en attente.
 */
final class VerificationController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'members.verify');
        $this->view('admin/verification', [
            'requests' => (new Verification())->queue(),
        ], 'layouts/admin');
    }

    public function approve(Request $request, array $params): void
    {
        $this->decide($request, (int) $params['id'], true);
    }

    public function reject(Request $request, array $params): void
    {
        $this->decide($request, (int) $params['id'], false);
    }

    /** Traite une décision d'approbation/rejet et notifie le membre. */
    private function decide(Request $request, int $requestId, bool $approve): void
    {
        $staff = $this->requirePermission($request, 'members.verify');
        $userId = (new Verification())->decide($requestId, (int) $staff['id'], $approve);

        if ($userId === null) {
            Session::flash('error', 'Demande introuvable ou déjà traitée.');
            $this->redirect('/admin/verification');
        }

        (new Notification())->push($userId, 'system', null, [
            'message' => $approve
                ? 'Bonne nouvelle : votre profil est désormais vérifié ✅'
                : 'Votre demande de vérification n\'a pas pu être validée. Vous pouvez réessayer avec un selfie plus net.',
        ]);
        (new ActivityLog())->record((int) $staff['id'], $approve ? 'verification.approve' : 'verification.reject',
            'user', $userId, [], $request->ip());

        Session::flash('success', $approve ? 'Profil vérifié.' : 'Demande rejetée.');
        $this->redirect('/admin/verification');
    }
}

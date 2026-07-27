<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;
use Amoura\Models\User;
use Amoura\Models\Verification;
use Amoura\Services\Uploader;
use Amoura\Services\Verification\HeuristicLivenessChecker;

/**
 * Vérification de profil par selfie côté membre (Phase 4, Sprint +10).
 * Le membre soumet un selfie → pré-analyse automatique → file de revue humaine.
 */
final class VerificationController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('verification/index', [
            'is_verified' => (int) ($user['is_verified'] ?? 0) === 1,
            'request' => (new Verification())->latestFor((int) $user['id']),
        ]);
    }

    public function submit(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $verification = new Verification();

        if ((int) ($user['is_verified'] ?? 0) === 1) {
            Session::flash('success', 'Votre profil est déjà vérifié.');
            $this->redirect('/verify-profile');
        }
        if ($verification->hasPending($uid)) {
            Session::flash('error', 'Une demande est déjà en cours d\'examen.');
            $this->redirect('/verify-profile');
        }

        $file = $request->file('selfie');
        if (!$file) {
            Session::flash('error', 'Veuillez joindre un selfie.');
            $this->redirect('/verify-profile');
        }

        // Stockage privé du selfie (dossier dédié, non listé publiquement).
        $up = Uploader::image($file, 'verifications');
        if (!$up['ok']) {
            Session::flash('error', $up['error'] ?? 'Image invalide.');
            $this->redirect('/verify-profile');
        }

        // Pré-analyse heuristique (v1) — remplaçable par un prestataire liveness.
        $abs = dirname(__DIR__, 2) . '/public/uploads/' . $up['path'];
        $analysis = (new HeuristicLivenessChecker())->analyze($abs);

        $verification->submit($uid, (string) $up['path'], $analysis['score']);
        (new ActivityLog())->record($uid, 'verification.submit', 'user', $uid,
            ['score' => $analysis['score'], 'flags' => $analysis['flags']], $request->ip());

        Session::flash('success', 'Selfie envoyé ! Notre équipe examinera votre demande sous peu.');
        $this->redirect('/verify-profile');
    }
}

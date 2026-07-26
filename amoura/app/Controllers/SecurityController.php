<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Auth;
use Amoura\Core\Security\Totp;
use Amoura\Models\ActivityLog;
use Amoura\Models\User;

/** Paramètres de sécurité du compte : 2FA (TOTP) et révocation de sessions. */
final class SecurityController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $fresh = (new User())->find((int) $user['id']);

        $setupUri = null;
        // En cours de configuration : secret défini mais 2FA pas encore activée.
        if (!empty($fresh['totp_secret']) && (int) $fresh['totp_enabled'] === 0) {
            $issuer = (string) Env::get('APP_NAME', 'Amoura');
            $account = $fresh['email'] ?? ('user' . $fresh['id']);
            $setupUri = Totp::provisioningUri((string) $fresh['totp_secret'], $account, $issuer);
        }

        $this->view('profile/security', [
            'totp_enabled' => (int) $fresh['totp_enabled'] === 1,
            'setup_secret' => !empty($fresh['totp_secret']) && (int) $fresh['totp_enabled'] === 0 ? $fresh['totp_secret'] : null,
            'setup_uri' => $setupUri,
        ]);
    }

    /** Génère un secret et bascule la page en mode configuration. */
    public function setupTotp(Request $request): void
    {
        $user = $this->requireAuth($request);
        (new User())->setTotpSecret((int) $user['id'], Totp::generateSecret());
        Session::flash('success', 'Scannez le QR code puis saisissez un code pour activer.');
        $this->redirect('/settings/security');
    }

    /** Confirme et active la 2FA après vérification d'un premier code. */
    public function enableTotp(Request $request): void
    {
        $user = $this->requireAuth($request);
        $fresh = (new User())->find((int) $user['id']);
        $code = (string) $request->input('code');

        if (empty($fresh['totp_secret']) || !Totp::verify((string) $fresh['totp_secret'], $code)) {
            Session::flash('error', 'Code invalide, réessayez.');
            $this->redirect('/settings/security');
        }
        (new User())->enableTotp((int) $user['id']);
        (new ActivityLog())->record((int) $user['id'], '2fa.enabled', 'user', (int) $user['id'], [], $request->ip());
        Session::flash('success', 'Authentification à deux facteurs activée ✅');
        $this->redirect('/settings/security');
    }

    /** Désactive la 2FA (nécessite le mot de passe courant). */
    public function disableTotp(Request $request): void
    {
        $user = $this->requireAuth($request);
        $fresh = (new User())->find((int) $user['id']);
        $password = (string) $request->input('password');

        if (!Auth::verify($password, (string) $fresh['password_hash'])) {
            Session::flash('error', 'Mot de passe incorrect.');
            $this->redirect('/settings/security');
        }
        (new User())->disableTotp((int) $user['id']);
        (new ActivityLog())->record((int) $user['id'], '2fa.disabled', 'user', (int) $user['id'], [], $request->ip());
        Session::flash('success', 'Authentification à deux facteurs désactivée.');
        $this->redirect('/settings/security');
    }

    /** « Déconnecter partout » : invalide toutes les sessions sauf la courante. */
    public function revokeSessions(Request $request): void
    {
        $user = $this->requireAuth($request);
        (new User())->revokeSessions((int) $user['id']);
        // La session courante reste valide : on la ré-horodate au-delà du seuil.
        Session::regenerate();
        Session::put('_auth_time', time() + 1);
        (new ActivityLog())->record((int) $user['id'], 'sessions.revoked', 'user', (int) $user['id'], [], $request->ip());
        Session::flash('success', 'Toutes les autres sessions ont été déconnectées.');
        $this->redirect('/settings/security');
    }
}

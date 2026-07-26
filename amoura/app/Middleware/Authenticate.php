<?php
declare(strict_types=1);

namespace Amoura\Middleware;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Session;
use Amoura\Core\Security\Auth;

/** Exige une session authentifiée active. */
final class Authenticate
{
    public function handle(Request $request, array $params): bool
    {
        if (!Auth::check()) {
            if ($request->wantsJson()) {
                Response::error('Authentification requise', 401);
            }
            Session::put('intended_url', $request->path());
            Response::redirect('/login');
        }
        // Bloque les comptes suspendus/bannis.
        $user = Auth::user();
        if ($user && in_array($user['status'], ['suspended', 'banned'], true)) {
            Auth::logout();
            Response::redirect('/login?blocked=1');
        }
        return true;
    }
}

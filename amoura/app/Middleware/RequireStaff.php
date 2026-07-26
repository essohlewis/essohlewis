<?php
declare(strict_types=1);

namespace Amoura\Middleware;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\View;
use Amoura\Core\Security\Auth;

/** Réserve l'accès à l'espace d'administration au personnel (is_staff). */
final class RequireStaff
{
    public function handle(Request $request, array $params): bool
    {
        if (!Auth::check()) {
            Response::redirect('/login');
        }
        if (!Auth::isStaff()) {
            http_response_code(403);
            View::render('errors/error', ['code' => 403, 'message' => 'Espace réservé au personnel.'], null);
            exit;
        }
        return true;
    }
}

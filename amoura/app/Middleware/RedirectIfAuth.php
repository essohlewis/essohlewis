<?php
declare(strict_types=1);

namespace Amoura\Middleware;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Security\Auth;

/** Renvoie les utilisateurs déjà connectés loin des pages invité (login/register). */
final class RedirectIfAuth
{
    public function handle(Request $request, array $params): bool
    {
        if (Auth::check()) {
            Response::redirect('/app');
        }
        return true;
    }
}

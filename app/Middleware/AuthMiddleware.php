<?php

declare(strict_types=1);

namespace Transouscris\Middleware;

use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Session;

/**
 * Exige un utilisateur authentifié. Redirige vers /login pour le web,
 * renvoie 401 pour les requêtes JSON.
 */
final class AuthMiddleware implements Middleware
{
    public function handle(Request $request, callable $next): Response
    {
        if (Session::userId() === null) {
            if ($request->expectsJson()) {
                throw new HttpException(401);
            }
            return (new Response())->redirect('/login');
        }
        return $next($request);
    }
}

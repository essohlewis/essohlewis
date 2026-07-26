<?php
declare(strict_types=1);

namespace Amoura\Middleware;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Security\Csrf;

/** Vérifie le jeton CSRF sur toute requête mutative. */
final class VerifyCsrf
{
    public function handle(Request $request, array $params): bool
    {
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $token = (string) ($request->input('_csrf') ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
            if (!Csrf::verify($token)) {
                if ($request->wantsJson()) {
                    Response::error('Jeton CSRF invalide', 419);
                }
                http_response_code(419);
                exit('Jeton CSRF invalide ou expiré.');
            }
        }
        return true;
    }
}

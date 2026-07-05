<?php

declare(strict_types=1);

namespace Transouscris\Middleware;

use Transouscris\Core\Csrf;
use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Vérifie le jeton CSRF sur toutes les méthodes mutantes (POST/PUT/PATCH/DELETE).
 * Les webhooks de paiement sont exclus : ils utilisent une vérification de
 * signature HMAC dédiée (voir PaymentController) et non le jeton de session.
 */
final class CsrfMiddleware implements Middleware
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request, callable $next): Response
    {
        if (in_array($request->method(), self::SAFE_METHODS, true)) {
            return $next($request);
        }

        $token = $request->input('_csrf') ?? $request->header('x-csrf-token');
        if (!Csrf::verify(is_string($token) ? $token : null)) {
            throw new HttpException(419);
        }

        return $next($request);
    }
}

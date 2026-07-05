<?php

declare(strict_types=1);

namespace Transouscris\Middleware;

use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\RateLimiter;
use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Applique un rate limit par IP sur les routes sensibles (paiement).
 * Le rate limiting OTP, plus fin (par numéro), est appliqué dans OtpService.
 *
 * Valeurs par défaut : 30 requêtes / 60 s / IP.
 */
final class RateLimitMiddleware implements Middleware
{
    public function __construct(
        private int $maxHits = 30,
        private int $window = 60
    ) {}

    public function handle(Request $request, callable $next): Response
    {
        $key = 'http:' . $request->path() . ':' . $request->ip();
        if (!RateLimiter::attempt($key, $this->maxHits, $this->window)) {
            throw new HttpException(429);
        }
        return $next($request);
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Middleware;

use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Session;
use Transouscris\Models\User;

/**
 * Restreint l'accès aux utilisateurs ayant le rôle admin.
 */
final class AdminMiddleware implements Middleware
{
    public function handle(Request $request, callable $next): Response
    {
        $id   = Session::userId();
        $user = $id ? User::find($id) : null;

        if ($user === null) {
            throw new HttpException(401);
        }
        if (!$user->isAdmin()) {
            throw new HttpException(403);
        }

        return $next($request);
    }
}

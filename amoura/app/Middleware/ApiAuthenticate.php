<?php
declare(strict_types=1);

namespace Amoura\Middleware;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Security\Auth;
use Amoura\Models\ApiToken;
use Amoura\Models\User;

/**
 * Authentification stateless de l'API mobile : exige un en-tête
 * `Authorization: Bearer <jeton>` valide. Résout le jeton (haché) vers son
 * utilisateur, rejette les comptes suspendus/bannis, puis publie l'utilisateur
 * pour le reste de la requête via Auth::actingAs() — sans session ni cookie.
 */
final class ApiAuthenticate
{
    public function handle(Request $request, array $params): bool
    {
        $plain = $request->bearerToken();
        if ($plain === null || $plain === '') {
            Response::error('Jeton d\'accès requis', 401);
        }

        $token = (new ApiToken())->resolve((string) $plain);
        if ($token === null) {
            Response::error('Jeton invalide ou expiré', 401);
        }

        $user = (new User())->withRole((int) $token['user_id']);
        if ($user === null || in_array($user['status'], ['suspended', 'banned', 'deleted'], true)) {
            Response::error('Compte indisponible', 401);
        }

        Auth::actingAs($user, $token);
        return true;
    }
}

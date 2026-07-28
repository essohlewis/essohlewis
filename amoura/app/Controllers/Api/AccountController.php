<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Models\ApiToken;

/**
 * Compte de l'utilisateur authentifié par jeton : profil courant et gestion des
 * jetons d'accès (lister, révoquer un appareil, tout révoquer).
 */
final class AccountController extends ApiController
{
    /** Profil de l'utilisateur courant. */
    public function me(Request $request): void
    {
        $this->requireAbility('profile:read');
        Response::ok(['user' => $this->publicUser($this->user())]);
    }

    /** Liste des jetons/appareils actifs de l'utilisateur. */
    public function tokens(Request $request): void
    {
        $rows = (new ApiToken())->forUser((int) $this->user()['id']);
        $tokens = array_map(static fn(array $t): array => [
            'id'           => (int) $t['id'],
            'name'         => $t['name'],
            'abilities'    => ApiToken::abilitiesOf($t),
            'last_used_at' => $t['last_used_at'],
            'expires_at'   => $t['expires_at'],
            'created_at'   => $t['created_at'],
        ], $rows);
        Response::ok(['tokens' => $tokens]);
    }

    /** Révoque un jeton précis (borné au propriétaire). */
    public function revokeToken(Request $request, array $params): void
    {
        $ok = (new ApiToken())->revoke((int) $params['id'], (int) $this->user()['id']);
        if (!$ok) {
            Response::error('Jeton introuvable', 404);
        }
        Response::ok(['revoked' => true]);
    }

    /** Révoque tous les jetons de l'utilisateur (déconnecte tous les appareils). */
    public function revokeAll(Request $request): void
    {
        $count = (new ApiToken())->revokeAll((int) $this->user()['id']);
        Response::ok(['revoked' => $count]);
    }
}

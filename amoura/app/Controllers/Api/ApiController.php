<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Controller;
use Amoura\Core\Response;
use Amoura\Core\Security\Auth;

/**
 * Base des contrôleurs de l'API mobile (JSON, stateless). L'utilisateur courant
 * est garanti par le middleware ApiAuthenticate. Fournit la vérification de
 * portée (abilities) et une représentation publique et stable de l'utilisateur.
 */
abstract class ApiController extends Controller
{
    /** Utilisateur authentifié par jeton (garanti non nul derrière ApiAuthenticate). @return array<string,mixed> */
    protected function user(): array
    {
        return Auth::user() ?? [];
    }

    /** Exige une portée sur le jeton courant, sinon 403. */
    protected function requireAbility(string $ability): void
    {
        if (!Auth::tokenAllows($ability)) {
            Response::error('Portée insuffisante pour cette action', 403, ['required' => $ability]);
        }
    }

    /**
     * Projection publique et stable d'un utilisateur pour l'API (jamais de hash,
     * secret 2FA, etc.).
     *
     * @param array<string,mixed> $u
     * @return array<string,mixed>
     */
    protected function publicUser(array $u): array
    {
        return [
            'id'           => (int) $u['id'],
            'display_name' => $u['display_name'] ?? null,
            'email'        => $u['email'] ?? null,
            'status'       => $u['status'] ?? null,
            'is_verified'  => (bool) ($u['is_verified'] ?? false),
            'role'         => $u['role_slug'] ?? null,
            'created_at'   => $u['created_at'] ?? null,
        ];
    }
}

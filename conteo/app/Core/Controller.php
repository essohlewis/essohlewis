<?php

declare(strict_types=1);

namespace App\Core;

use App\Helpers\Auth;

/**
 * Contrôleur de base. Fournit l'accès à l'utilisateur authentifié courant.
 */
abstract class Controller
{
    /** @return array<string,mixed>|null */
    protected function user(): ?array
    {
        return Auth::currentUser();
    }

    /** ID de l'utilisateur authentifié ou 0. */
    protected function userId(): int
    {
        return (int) (Auth::currentUser()['id'] ?? 0);
    }
}

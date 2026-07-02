<?php

declare(strict_types=1);

namespace Transouscris\Core;

use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Models\User;

/**
 * Contrôleur de base : helpers de rendu, JSON, redirection, et accès à
 * l'utilisateur authentifié.
 */
abstract class Controller
{
    protected function view(string $template, array $data = [], ?string $layout = 'layouts/app'): Response
    {
        $data += [
            'auth'      => $this->user(),
            'csrf'      => Csrf::token(),
            'appName'   => Config::get('app.name'),
        ];
        return (new Response())->html(View::render($template, $data, $layout));
    }

    protected function json(array $data, int $status = 200): Response
    {
        return (new Response())->json($data, $status);
    }

    protected function redirect(string $url): Response
    {
        return (new Response())->redirect($url);
    }

    protected function back(string $fallback = '/'): Response
    {
        $ref = $_SERVER['HTTP_REFERER'] ?? $fallback;
        return $this->redirect($ref);
    }

    /** Utilisateur connecté ou null. */
    protected function user(): ?User
    {
        $id = Session::userId();
        return $id ? User::find($id) : null;
    }

    /** Utilisateur connecté ou 401. */
    protected function requireUser(): User
    {
        $user = $this->user();
        if ($user === null) {
            throw new HttpException(401);
        }
        return $user;
    }

    /**
     * Garde-fou IDOR : vérifie que la ressource appartient à l'utilisateur.
     * $ownerId est l'user_id propriétaire de la ressource consultée.
     */
    protected function authorizeOwnership(int $ownerId, ?User $user = null): void
    {
        $user ??= $this->requireUser();
        if ($user->id !== $ownerId && !$user->isAdmin()) {
            throw new HttpException(403);
        }
    }
}

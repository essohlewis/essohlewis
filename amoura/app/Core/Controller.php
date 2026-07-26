<?php
declare(strict_types=1);

namespace Amoura\Core;

use Amoura\Core\Security\Auth;
use Amoura\Core\Security\Csrf;

/**
 * Contrôleur de base : rendu de vues, réponses JSON, garde d'authentification
 * et vérification CSRF pour les requêtes mutatives.
 */
abstract class Controller
{
    protected function view(string $view, array $data = [], ?string $layout = 'layouts/app'): void
    {
        Response::securityHeaders();
        // Données globales injectées dans toutes les vues.
        $data['auth'] = Auth::user();
        $data['csrf'] = Csrf::token();
        $data['flash'] = ['success' => Session::flash('success'), 'error' => Session::flash('error')];
        View::render($view, $data, $layout);
    }

    protected function json(mixed $data, int $status = 200): void
    {
        Response::json($data, $status);
    }

    protected function redirect(string $to): void
    {
        Response::redirect($to);
    }

    /** Exige une session authentifiée, sinon redirige/renvoie 401. */
    protected function requireAuth(Request $request): array
    {
        $user = Auth::user();
        if ($user === null) {
            if ($request->wantsJson()) {
                Response::error('Authentification requise', 401);
            }
            Session::put('intended_url', $request->path());
            $this->redirect('/login');
        }
        return $user;
    }

    /** Vérifie le jeton CSRF pour toute requête POST/PUT/PATCH/DELETE. */
    protected function verifyCsrf(Request $request): void
    {
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $token = $request->input('_csrf') ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
            if (!Csrf::verify((string) $token)) {
                if ($request->wantsJson()) {
                    Response::error('Jeton CSRF invalide', 419);
                }
                http_response_code(419);
                exit('Jeton CSRF invalide ou expiré.');
            }
        }
    }

    /** Exige une permission staff donnée (ex: "moderation.review"). */
    protected function requirePermission(Request $request, string $permission): array
    {
        $user = $this->requireAuth($request);
        if (!Auth::can($permission)) {
            if ($request->wantsJson()) {
                Response::error('Accès refusé', 403);
            }
            http_response_code(403);
            $this->view('errors/error', ['code' => 403, 'message' => 'Accès refusé'], null);
            exit;
        }
        return $user;
    }
}

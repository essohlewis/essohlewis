<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/**
 * Contrôleur de base.
 *
 * Fournit le rendu des vues (avec layout), les réponses JSON et les
 * redirections. Aucune logique HTML ne doit vivre dans les contrôleurs
 * concrets : ils appellent uniquement view()/json()/redirect().
 */
abstract class Controller
{
    protected Request $request;

    public function __construct()
    {
        $this->request = new Request();
    }

    /**
     * Rend une vue dans un layout.
     *
     * @param string               $view   Chemin relatif sous Views, ex : "home/index"
     * @param array<string, mixed> $data   Variables extraites dans la vue
     * @param string               $layout Layout enveloppant (défaut : main)
     */
    protected function view(string $view, array $data = [], string $layout = 'main'): void
    {
        $content = $this->renderPartial($view, $data);

        // Le contenu de la vue est injecté dans le layout via $content.
        $layoutData = array_merge($data, ['content' => $content]);
        echo $this->renderPartial('layouts/' . $layout, $layoutData);
    }

    /**
     * Rend une vue et retourne le HTML (sans layout).
     *
     * @param array<string, mixed> $data
     */
    protected function renderPartial(string $view, array $data = []): string
    {
        $file = VIEW_PATH . '/' . $view . '.php';
        if (!is_file($file)) {
            throw new RuntimeException("Vue introuvable : {$view}");
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $file;
        return (string) ob_get_clean();
    }

    /**
     * Réponse JSON.
     *
     * @param array<string, mixed>|list<mixed> $data
     */
    protected function json(array $data, int $status = 200): never
    {
        Response::json($data, $status);
    }

    /** Redirection interne. */
    protected function redirect(string $path): never
    {
        Response::redirect($path);
    }

    /**
     * Vérifie le jeton CSRF d'une requête POST ; interrompt en 419 si invalide.
     */
    protected function verifyCsrf(): void
    {
        $token = $this->request->post(CSRF_TOKEN_NAME);
        if (!Csrf::validate(is_string($token) ? $token : null)) {
            if ($this->request->wantsJson()) {
                $this->json(['error' => 'Jeton CSRF invalide ou expiré.'], 419);
            }
            Response::status(419);
            echo 'Jeton CSRF invalide ou expiré. Rechargez la page.';
            exit;
        }
    }
}

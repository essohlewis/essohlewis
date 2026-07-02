<?php
/**
 * Contrôleur de base : rendu des vues et helpers communs.
 */

declare(strict_types=1);

namespace App\Core;

abstract class Controller
{
    /** @var array<string,mixed> Configuration applicative */
    protected array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    /**
     * Rend une vue dans le layout principal.
     *
     * @param string              $vue     Chemin relatif sous Views (ex: 'client/catalogue')
     * @param array<string,mixed> $donnees Variables exposées à la vue
     */
    protected function rendre(string $vue, array $donnees = [], string $layout = 'principal'): void
    {
        $donnees['config'] = $this->config;
        extract($donnees, EXTR_SKIP);

        $cheminVue = VIEW_PATH . '/' . $vue . '.php';
        if (!is_file($cheminVue)) {
            http_response_code(500);
            echo "Vue introuvable : {$vue}";
            return;
        }

        // Capture le contenu de la vue pour l'injecter dans le layout.
        ob_start();
        require $cheminVue;
        $contenu = ob_get_clean();

        require VIEW_PATH . '/layouts/' . $layout . '.php';
    }

    /** Redirection HTTP puis arrêt. */
    protected function rediriger(string $url): void
    {
        header('Location: ' . $this->url($url));
        exit;
    }

    /** Construit une URL absolue en tenant compte du base_url. */
    protected function url(string $chemin): string
    {
        $base = rtrim($this->config['app']['base_url'], '/');
        return $base . '/' . ltrim($chemin, '/');
    }

    /** Réponse JSON (API légère, ex: statut de commande). */
    protected function json(array $donnees, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** Valeur POST nettoyée (chaîne). */
    protected function post(string $cle, string $defaut = ''): string
    {
        return isset($_POST[$cle]) ? trim((string) $_POST[$cle]) : $defaut;
    }

    protected function estPost(): bool
    {
        return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
    }
}

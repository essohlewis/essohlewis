<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/**
 * Routeur HTTP.
 *
 * Associe une méthode + un motif d'URL à une action de contrôleur.
 * Prend en charge les paramètres dynamiques nommés, ex : /forfait/{id}.
 * Le paramètre capturé est transmis à la méthode du contrôleur.
 */
final class Router
{
    /**
     * Table des routes.
     *
     * @var array<string, list<array{pattern:string, regex:string, params:list<string>, handler:array{0:class-string, 1:string}}>>
     */
    private array $routes = [
        'GET'    => [],
        'POST'   => [],
        'PUT'    => [],
        'DELETE' => [],
    ];

    /**
     * Enregistre une route.
     *
     * @param array{0:class-string, 1:string} $handler [Classe, méthode]
     */
    public function add(string $method, string $pattern, array $handler): void
    {
        $method = strtoupper($method);
        $pattern = '/' . trim($pattern, '/');
        $pattern = $pattern === '/' ? '/' : rtrim($pattern, '/');

        // Convertit {param} en groupe de capture nommé et collecte les noms.
        $params = [];
        $regex = preg_replace_callback(
            '#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#',
            static function (array $m) use (&$params): string {
                $params[] = $m[1];
                return '([^/]+)';
            },
            $pattern
        );

        $this->routes[$method][] = [
            'pattern' => $pattern,
            'regex'   => '#^' . $regex . '$#',
            'params'  => $params,
            'handler' => $handler,
        ];
    }

    public function get(string $pattern, array $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, array $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function put(string $pattern, array $handler): void
    {
        $this->add('PUT', $pattern, $handler);
    }

    public function delete(string $pattern, array $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    /**
     * Résout la requête courante et exécute l'action correspondante.
     */
    public function dispatch(Request $request): void
    {
        $method = $request->method();
        $path = $request->path();

        foreach ($this->routes[$method] ?? [] as $route) {
            if (preg_match($route['regex'], $path, $matches)) {
                array_shift($matches); // retire la correspondance globale

                [$class, $action] = $route['handler'];
                if (!class_exists($class)) {
                    throw new RuntimeException("Contrôleur introuvable : {$class}");
                }

                $controller = new $class();
                if (!method_exists($controller, $action)) {
                    throw new RuntimeException("Action introuvable : {$class}::{$action}");
                }

                // Les segments capturés sont passés dans l'ordre à l'action.
                $controller->{$action}(...array_map('rawurldecode', $matches));
                return;
            }
        }

        $this->notFound($request);
    }

    /** Réponse 404. */
    private function notFound(Request $request): void
    {
        Response::status(404);
        if ($request->wantsJson()) {
            Response::json(['error' => 'Ressource introuvable.'], 404);
        }
        $file = VIEW_PATH . '/errors/404.php';
        if (is_file($file)) {
            // Injecte le fragment d'erreur dans le layout principal.
            $title = 'Page introuvable';
            ob_start();
            require $file;
            $content = ob_get_clean();
            require VIEW_PATH . '/layouts/main.php';
        } else {
            echo '404 — Page introuvable.';
        }
    }
}

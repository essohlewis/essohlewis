<?php

declare(strict_types=1);

namespace Transouscris\Core;

use Transouscris\Core\Exceptions\HttpException;

/**
 * Routeur avec support des paramètres nommés ({id}), groupes de middleware,
 * et résolution contrôleur@action.
 */
final class Router
{
    /** @var array<int, array{method:string,pattern:string,regex:string,handler:mixed,middleware:array}> */
    private array $routes = [];

    /** @var array<string, mixed> pile de middleware pour le groupe courant */
    private array $groupMiddleware = [];
    private string $groupPrefix = '';

    public function get(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function delete(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    /**
     * Groupe de routes partageant un préfixe et/ou des middlewares.
     */
    public function group(array $options, callable $callback): void
    {
        $previousPrefix     = $this->groupPrefix;
        $previousMiddleware = $this->groupMiddleware;

        $this->groupPrefix    .= $options['prefix'] ?? '';
        $this->groupMiddleware = array_merge($this->groupMiddleware, $options['middleware'] ?? []);

        $callback($this);

        $this->groupPrefix     = $previousPrefix;
        $this->groupMiddleware = $previousMiddleware;
    }

    private function add(string $method, string $path, mixed $handler, array $middleware): void
    {
        $pattern = $this->groupPrefix . $path;
        $pattern = '/' . trim($pattern, '/');
        if ($pattern === '/') {
            $pattern = '/';
        }

        $regex = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $pattern);
        $regex = '#^' . $regex . '$#';

        $this->routes[] = [
            'method'     => $method,
            'pattern'    => $pattern,
            'regex'      => $regex,
            'handler'    => $handler,
            'middleware' => array_merge($this->groupMiddleware, $middleware),
        ];
    }

    /**
     * Résout la requête et retourne [handler, params, middleware].
     *
     * @return array{0:mixed,1:array<string,string>,2:array}
     */
    public function match(string $method, string $path): array
    {
        $pathMatched = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }
            $pathMatched = true;

            if ($route['method'] !== $method) {
                continue;
            }

            $params = array_filter(
                $matches,
                static fn ($k) => !is_int($k),
                ARRAY_FILTER_USE_KEY
            );

            return [$route['handler'], $params, $route['middleware']];
        }

        // Chemin connu mais mauvaise méthode → 405, sinon 404.
        throw new HttpException($pathMatched ? 405 : 404);
    }
}

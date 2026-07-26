<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Routeur léger « maison ».
 * Supporte les paramètres nommés ({id}), les groupes de middlewares et
 * la résolution « Controller@method ».
 */
final class Router
{
    /** @var array<int,array{method:string,pattern:string,regex:string,params:array,handler:mixed,middlewares:array}> */
    private array $routes = [];
    private array $groupStack = [];

    public function get(string $path, mixed $handler, array $mw = []): void    { $this->add('GET', $path, $handler, $mw); }
    public function post(string $path, mixed $handler, array $mw = []): void   { $this->add('POST', $path, $handler, $mw); }
    public function put(string $path, mixed $handler, array $mw = []): void    { $this->add('PUT', $path, $handler, $mw); }
    public function patch(string $path, mixed $handler, array $mw = []): void  { $this->add('PATCH', $path, $handler, $mw); }
    public function delete(string $path, mixed $handler, array $mw = []): void { $this->add('DELETE', $path, $handler, $mw); }

    /**
     * Groupe de routes partageant un préfixe et/ou des middlewares.
     * @param array{prefix?:string,middleware?:array} $attributes
     */
    public function group(array $attributes, callable $callback): void
    {
        $this->groupStack[] = $attributes;
        $callback($this);
        array_pop($this->groupStack);
    }

    private function add(string $method, string $path, mixed $handler, array $mw): void
    {
        $prefix = '';
        $middlewares = $mw;
        foreach ($this->groupStack as $group) {
            $prefix .= $group['prefix'] ?? '';
            $middlewares = array_merge($group['middleware'] ?? [], $middlewares);
        }
        $pattern = '/' . trim($prefix . $path, '/');
        if ($pattern === '/') {
            $pattern = '/';
        }

        // Convertit {param} en groupe de capture nommé.
        $params = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_]\w*)\}#', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $regex = '#^' . $regex . '$#';

        $this->routes[] = compact('method', 'pattern', 'regex', 'params', 'handler', 'middlewares');
    }

    /**
     * Résout la requête, exécute les middlewares puis le contrôleur.
     */
    public function dispatch(Request $request): void
    {
        $method = $request->method();
        $path   = $request->path();

        $allowedMethods = [];
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }
            if ($route['method'] !== $method) {
                $allowedMethods[] = $route['method'];
                continue;
            }

            array_shift($matches);
            $params = array_combine($route['params'], $matches) ?: [];

            // Chaîne de middlewares.
            foreach ($route['middlewares'] as $mw) {
                $instance = is_string($mw) ? new $mw() : $mw;
                $result = $instance->handle($request, $params);
                if ($result === false) {
                    return; // le middleware a déjà répondu/redirigé
                }
            }

            $this->invoke($route['handler'], $request, $params);
            return;
        }

        if (!empty($allowedMethods)) {
            header('Allow: ' . implode(', ', array_unique($allowedMethods)));
            $this->fail($request, 405, 'Méthode non autorisée');
            return;
        }
        $this->fail($request, 404, 'Page introuvable');
    }

    private function invoke(mixed $handler, Request $request, array $params): void
    {
        if (is_callable($handler)) {
            $handler($request, $params);
            return;
        }
        // Format "App\Controllers\FooController@bar"
        [$class, $action] = explode('@', $handler);
        $controller = new $class();
        $controller->$action($request, $params);
    }

    private function fail(Request $request, int $status, string $message): void
    {
        if ($request->wantsJson()) {
            Response::error($message, $status);
        }
        http_response_code($status);
        View::render('errors/error', ['code' => $status, 'message' => $message], null);
        exit;
    }
}

<?php

declare(strict_types=1);

namespace App\Core;

use App\Helpers\Auth;

/**
 * Routeur minimal à segments. Supporte les paramètres {name} et un
 * middleware « auth » optionnel par route.
 */
final class Router
{
    /** @var array<int,array{method:string,pattern:string,handler:callable|array,auth:bool}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable|array $handler, bool $auth = false): void
    {
        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => '/' . trim($pattern, '/'),
            'handler' => $handler,
            'auth'    => $auth,
        ];
    }

    public function get(string $p, callable|array $h, bool $auth = false): void    { $this->add('GET', $p, $h, $auth); }
    public function post(string $p, callable|array $h, bool $auth = false): void   { $this->add('POST', $p, $h, $auth); }
    public function patch(string $p, callable|array $h, bool $auth = false): void  { $this->add('PATCH', $p, $h, $auth); }
    public function delete(string $p, callable|array $h, bool $auth = false): void { $this->add('DELETE', $p, $h, $auth); }

    /**
     * Achemine la requête. Renvoie true si une route a été trouvée (même si
     * elle a répondu 401), false si aucune route ne correspond — le front
     * controller peut alors servir la coquille SPA.
     */
    public function dispatch(Request $request): bool
    {
        $method = $request->method();
        $path = $request->path();

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            $params = $this->match($route['pattern'], $path);
            if ($params === null) {
                continue;
            }

            $request->setParams($params);

            if ($route['auth']) {
                $user = Auth::authenticate($request);
                if ($user === null) {
                    Response::error('Non authentifié.', 401);
                    return true;
                }
            }

            $this->invoke($route['handler'], $request);
            return true;
        }

        return false;
    }

    /**
     * Compare un pattern à un chemin. Renvoie les paramètres capturés ou null.
     * @return array<string,string>|null
     */
    private function match(string $pattern, string $path): ?array
    {
        $pSeg = explode('/', trim($pattern, '/'));
        $uSeg = explode('/', trim($path, '/'));
        if (count($pSeg) !== count($uSeg)) {
            return null;
        }
        $params = [];
        foreach ($pSeg as $i => $seg) {
            if (str_starts_with($seg, '{') && str_ends_with($seg, '}')) {
                $params[trim($seg, '{}')] = urldecode($uSeg[$i]);
            } elseif ($seg !== $uSeg[$i]) {
                return null;
            }
        }
        return $params;
    }

    private function invoke(callable|array $handler, Request $request): void
    {
        if (is_array($handler)) {
            [$class, $action] = $handler;
            $controller = new $class();
            $controller->$action($request);
            return;
        }
        $handler($request);
    }
}

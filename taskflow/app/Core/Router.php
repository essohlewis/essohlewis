<?php
namespace App\Core;

class Router {
    private $routes = [];
    private $globalMiddlewares = [];

    // Register a global middleware
    public function use($middleware) {
        $this->globalMiddlewares[] = $middleware;
    }

    // Register a route with method, path, handler and route-specific middlewares
    public function addRoute($method, $path, $handler, $middlewares = []) {
        // Convert path parameter placeholder like :id or :taskId into capture groups
        $pattern = preg_replace('/:[a-zA-Z0-9_]+/', '([^/]+)', $path);
        
        // Extract parameter names (e.g., "id" or "taskId")
        preg_match_all('/:([a-zA-Z0-9_]+)/', $path, $paramNames);
        
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $path,
            'pattern' => '#^' . $pattern . '$#',
            'handler' => $handler,
            'middlewares' => $middlewares,
            'params' => $paramNames[1]
        ];
    }

    // HTTP method shortcuts
    public function get($path, $handler, $middlewares = []) { $this->addRoute('GET', $path, $handler, $middlewares); }
    public function post($path, $handler, $middlewares = []) { $this->addRoute('POST', $path, $handler, $middlewares); }
    public function put($path, $handler, $middlewares = []) { $this->addRoute('PUT', $path, $handler, $middlewares); }
    public function patch($path, $handler, $middlewares = []) { $this->addRoute('PATCH', $path, $handler, $middlewares); }
    public function delete($path, $handler, $middlewares = []) { $this->addRoute('DELETE', $path, $handler, $middlewares); }
    public function options($path, $handler, $middlewares = []) { $this->addRoute('OPTIONS', $path, $handler, $middlewares); }

    // Dispatch the request matching current URI and method
    public function dispatch($requestMethod, $requestUri) {
        $path = parse_url($requestUri, PHP_URL_PATH);
        $method = strtoupper($requestMethod);

        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $path, $matches)) {
                array_shift($matches); // Remove first match which is full string
                
                // Map matched values to parameter names
                $params = [];
                foreach ($route['params'] as $index => $name) {
                    $params[$name] = isset($matches[$index]) ? urldecode($matches[$index]) : null;
                }

                // Merge global middlewares with route-specific ones
                $middlewares = array_merge($this->globalMiddlewares, $route['middlewares']);
                
                $next = function() use ($route, $params) {
                    return $this->executeHandler($route['handler'], $params);
                };

                try {
                    return $this->runMiddlewareChain($middlewares, $params, $next);
                } catch (\Exception $e) {
                    Response::json(['message' => 'Une erreur interne est survenue.', 'error' => $e->getMessage()], 500);
                    return;
                }
            }
        }

        // Send 404 if no route matched
        Response::json(['message' => 'Route inconnue.'], 404);
    }

    // Execute middleware chain recursively
    private function runMiddlewareChain($middlewares, $params, $next) {
        if (empty($middlewares)) {
            return $next();
        }

        $middlewareClass = array_shift($middlewares);
        
        // Instantiate middleware
        if (class_exists($middlewareClass)) {
            $middleware = new $middlewareClass();
            return $middleware->handle($params, function() use ($middlewares, $params, $next) {
                return $this->runMiddlewareChain($middlewares, $params, $next);
            });
        } else {
            throw new \Exception("Le middleware $middlewareClass n'existe pas.");
        }
    }

    // Load controller and call target method
    private function executeHandler($handler, $params) {
        list($controllerClass, $method) = explode('@', $handler);
        $fullControllerClass = "App\\Controllers\\" . $controllerClass;

        if (!class_exists($fullControllerClass)) {
            Response::json(['message' => "Contrôleur $fullControllerClass introuvable."], 500);
            return;
        }

        $controller = new $fullControllerClass();
        if (!method_exists($controller, $method)) {
            Response::json(['message' => "Méthode $method introuvable dans $fullControllerClass."], 500);
            return;
        }

        // Pass path params to controller method
        return $controller->$method($params);
    }
}

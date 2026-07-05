<?php

declare(strict_types=1);

namespace Transouscris\Core;

use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Exceptions\ValidationException;

/**
 * Noyau de l'application : bootstrap (env, config, session), dispatch des
 * routes à travers la pile de middleware, et gestion centralisée des erreurs.
 */
final class App
{
    private Router $router;

    public function __construct(private string $basePath)
    {
        Env::load($basePath . '/.env');
        Config::load($basePath . '/config');
        Logger::configure($basePath . '/storage');
        View::configure($basePath . '/app/Views');

        date_default_timezone_set(Config::get('app.timezone', 'Africa/Abidjan'));
        $this->configureErrorDisplay();

        require_once $basePath . '/app/helpers.php';

        Session::start();

        $this->router = new Router();
        (require $basePath . '/app/routes.php')($this->router);
    }

    public function run(): void
    {
        $request  = new Request();
        $response = $this->handle($request);
        $response->send();
    }

    private function handle(Request $request): Response
    {
        try {
            [$handler, $params, $middleware] = $this->router->match($request->method(), $request->path());

            // Construit la chaîne de middleware terminée par le contrôleur.
            $core = function (Request $request) use ($handler, $params): Response {
                return $this->dispatch($handler, $request, $params);
            };

            $pipeline = array_reduce(
                array_reverse($middleware),
                function (callable $next, string $middlewareClass): callable {
                    return function (Request $request) use ($next, $middlewareClass): Response {
                        /** @var \Transouscris\Middleware\Middleware $instance */
                        $instance = new $middlewareClass();
                        return $instance->handle($request, $next);
                    };
                },
                $core
            );

            return $pipeline($request);
        } catch (ValidationException $e) {
            return $this->renderError($request, $e->statusCode(), $e->getMessage(), $e->errors());
        } catch (HttpException $e) {
            return $this->renderError($request, $e->statusCode(), $e->getMessage());
        } catch (\Throwable $e) {
            Logger::error($e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => Config::get('app.debug') ? $e->getTraceAsString() : null,
            ]);
            $message = Config::get('app.debug') ? $e->getMessage() : 'Erreur serveur.';
            return $this->renderError($request, 500, $message);
        }
    }

    private function dispatch(mixed $handler, Request $request, array $params): Response
    {
        // handler : 'Controller@method' ou callable.
        if (is_string($handler) && str_contains($handler, '@')) {
            [$class, $method] = explode('@', $handler);
            $class = 'Transouscris\\Controllers\\' . $class;
            $controller = new $class();
            $result = $controller->$method($request, ...array_values($params));
        } elseif (is_callable($handler)) {
            $result = $handler($request, ...array_values($params));
        } else {
            throw new HttpException(500, 'Handler de route invalide.');
        }

        if ($result instanceof Response) {
            return $result;
        }
        if (is_array($result)) {
            return (new Response())->json($result);
        }
        return (new Response())->html((string) $result);
    }

    private function renderError(Request $request, int $status, string $message, array $errors = []): Response
    {
        if ($request->expectsJson()) {
            $payload = ['error' => $message];
            if ($errors) {
                $payload['errors'] = $errors;
            }
            return (new Response())->json($payload, $status);
        }

        $html = View::render('errors/generic', [
            'status'  => $status,
            'message' => $message,
            'errors'  => $errors,
        ]);
        return (new Response())->html($html, $status);
    }

    private function configureErrorDisplay(): void
    {
        if (Config::get('app.debug')) {
            error_reporting(E_ALL);
            ini_set('display_errors', '1');
        } else {
            error_reporting(E_ALL & ~E_DEPRECATED);
            ini_set('display_errors', '0');
        }
    }
}

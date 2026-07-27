<?php
declare(strict_types=1);

/**
 * =============================================================================
 *  AMOURA — Front controller (point d'entrée unique).
 *  Tout le trafic HTTP est routé ici via public/.htaccess (ou php -S).
 * =============================================================================
 */

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Router;
use Amoura\Core\Session;

$root = dirname(__DIR__);

// 1) Autoloading — Composer si présent, sinon autoloader PSR-4 « maison ».
if (is_file($root . '/vendor/autoload.php')) {
    require $root . '/vendor/autoload.php';
} else {
    require $root . '/app/Core/Autoloader.php';
    $autoloader = new Autoloader();
    $autoloader->addNamespace('Amoura', $root . '/app');
    $autoloader->register();
    require $root . '/app/Helpers/functions.php';
}

// 2) Environnement & configuration.
Env::load($root . '/.env');
date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'UTC'));

// 2b) Observabilité : identifiant de corrélation + liveness ultra-léger.
if (PHP_SAPI !== 'cli') {
    \Amoura\Core\Observability\RequestContext::begin($_SERVER['HTTP_X_REQUEST_ID'] ?? null);
    header('X-Request-Id: ' . \Amoura\Core\Observability\RequestContext::id());

    $reqPath = rtrim((string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'), '/') ?: '/';
    if ($reqPath === '/healthz' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        (new \Amoura\Controllers\HealthController())->live();   // ni session ni dépendances
        exit;
    }
}

// 3) Gestion des erreurs selon l'environnement.
if (Env::bool('APP_DEBUG')) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
    ini_set('error_log', $root . '/storage/logs/php-error.log');
}

// 4) Session sécurisée.
Session::start();

// 4b) Locale (i18n) : cookie > Accept-Language > défaut.
\Amoura\Core\I18n::boot();

// 5) Chargement des routes et dispatch.
$router = new Router();
(require $root . '/app/routes.php')($router);

$request = new Request();
try {
    $router->dispatch($request);
} catch (\Throwable $e) {
    if (Env::bool('APP_DEBUG')) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Erreur : {$e->getMessage()}\n\n{$e->getFile()}:{$e->getLine()}\n\n{$e->getTraceAsString()}";
    } else {
        error_log((string) $e);
        \Amoura\Services\Logger::error('unhandled_exception', [
            'message' => $e->getMessage(),
            'file'    => $e->getFile() . ':' . $e->getLine(),
            'path'    => $_SERVER['REQUEST_URI'] ?? null,
        ]);
        http_response_code(500);
        \Amoura\Core\View::render('errors/error', ['code' => 500, 'message' => 'Une erreur est survenue.'], null);
    }
} finally {
    // Journal d'accès structuré (méthode, chemin, statut, durée, request_id).
    \Amoura\Services\Logger::info('http_request', [
        'method' => $request->method(),
        'path' => $request->path(),
        'status' => http_response_code() ?: 200,
        'duration_ms' => round(\Amoura\Core\Observability\RequestContext::durationMs(), 2),
    ]);
}

<?php

declare(strict_types=1);

/**
 * CONTEO — Front controller unique.
 *
 * Toutes les requêtes HTTP dynamiques (API, admin) sont routées ici via
 * .htaccess. Les requêtes vers des fichiers existants (assets, médias, PWA
 * shell) sont servies directement par le serveur web.
 */

// ── Autoloader PSR-4 minimal (App\ → app/) ──
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = dirname(__DIR__) . '/app/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

$config = require dirname(__DIR__) . '/config/config.php';

// ── Rapport d'erreurs selon l'environnement ──
if ($config['app']['debug']) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}

// ── CORS pour l'app packagée (Capacitor/Tauri servent depuis un origin local) ──
header('Vary: Origin');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    $config['app']['url'],
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'tauri://localhost',
];
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Helpers\Logger;

$router = new Router();
(require dirname(__DIR__) . '/config/routes.php')($router);

$request = new Request();

try {
    $matched = $router->dispatch($request);
    if (!$matched) {
        // Aucune route dynamique : les routes SPA (History API) reçoivent la
        // coquille ; les chemins API renvoient un 404 JSON.
        $path = $request->path();
        if (str_starts_with($path, '/api/')) {
            Response::error('Route introuvable.', 404);
        } else {
            header('Content-Type: text/html; charset=utf-8');
            readfile(__DIR__ . '/index.html');
        }
    }
} catch (\Throwable $e) {
    Logger::error('Unhandled exception', [
        'msg'  => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ]);
    if ($config['app']['debug']) {
        Response::error('Erreur serveur : ' . $e->getMessage(), 500);
    } else {
        Response::error('Une erreur interne est survenue.', 500);
    }
}

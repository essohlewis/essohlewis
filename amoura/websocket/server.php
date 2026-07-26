<?php
declare(strict_types=1);

/**
 * =============================================================================
 *  Serveur WebSocket Amoura (temps réel : chat, présence, notifications,
 *  signaling WebRTC). À lancer comme processus séparé :
 *
 *      php websocket/server.php
 *
 *  Prérequis : `composer install` (cboden/ratchet).
 *  En production, placez-le derrière un proxy TLS (wss://) — ex. Nginx.
 * =============================================================================
 */

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Websocket\ChatServer;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

$root = dirname(__DIR__);

// Autoloading (Composer requis pour Ratchet ; fallback pour le code applicatif).
if (is_file($root . '/vendor/autoload.php')) {
    require $root . '/vendor/autoload.php';
} else {
    fwrite(STDERR, "⚠  Lancez d'abord `composer install` pour installer Ratchet.\n");
    require $root . '/app/Core/Autoloader.php';
    $al = new Autoloader();
    $al->addNamespace('Amoura', $root . '/app');
    $al->addNamespace('Amoura\\Websocket', $root . '/websocket');
    $al->register();
    require $root . '/app/Helpers/functions.php';
}

Env::load($root . '/.env');
date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'UTC'));

$host = (string) Env::get('WS_HOST', '0.0.0.0');
$port = Env::int('WS_PORT', 8090);

echo "Amoura WebSocket en écoute sur {$host}:{$port}\n";

$server = IoServer::factory(
    new HttpServer(new WsServer(new ChatServer())),
    $port,
    $host
);
$server->run();

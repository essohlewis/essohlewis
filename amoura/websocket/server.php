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

// Bus temps réel : Redis pub/sub pour le clustering multi-instance, sinon local.
$busDriver = strtolower((string) Env::get('REALTIME_BUS', 'local'));
if ($busDriver === 'redis') {
    $redisUri = 'redis://' . Env::get('REDIS_HOST', '127.0.0.1') . ':' . Env::int('REDIS_PORT', 6379);
    $bus = new \Amoura\Websocket\Bus\RedisBus($redisUri, (string) Env::get('REDIS_CHANNEL', 'amoura:realtime'));
    echo "Bus temps réel : Redis ({$redisUri})\n";
} else {
    $bus = new \Amoura\Websocket\Bus\LocalBus();
    echo "Bus temps réel : local (mono-instance)\n";
}

echo "Amoura WebSocket en écoute sur {$host}:{$port}\n";

$server = IoServer::factory(
    new HttpServer(new WsServer(new ChatServer($bus))),
    $port,
    $host
);

// Démarre le bus dans la boucle d'événements du serveur.
$bus->start($server->loop);

$server->run();

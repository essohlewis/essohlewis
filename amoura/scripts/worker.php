<?php
declare(strict_types=1);

/**
 * Worker de la file d'envoi e-mail/SMS (Phase 1, Sprint +7).
 *
 * Deux usages :
 *   php scripts/worker.php            # démon : draine la file en continu
 *   php scripts/worker.php --once     # une seule passe (idéal pour cron minute)
 *
 * Exemple cron (toutes les minutes) :
 *   *\/1 * * * *  php /chemin/amoura/scripts/worker.php --once >> storage/logs/worker.log 2>&1
 *
 * En mode démon, s'arrête proprement sur SIGTERM/SIGINT (compatible systemd).
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Services\Logger;
use Amoura\Services\Messaging\Dispatcher;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
require __DIR__ . '/../app/Helpers/functions.php';
Env::load(__DIR__ . '/../.env');
date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'UTC'));

$once = in_array('--once', $argv, true);
$batch = (int) Env::get('QUEUE_BATCH', 50);
$idleSleep = max(1, (int) Env::get('QUEUE_IDLE_SLEEP', 5)); // secondes entre passes à vide

// Arrêt propre en mode démon.
$running = true;
if (function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    $stop = function () use (&$running) { $running = false; };
    pcntl_signal(SIGTERM, $stop);
    pcntl_signal(SIGINT, $stop);
}

do {
    try {
        $r = Dispatcher::drain($batch);
        if ($r['processed'] > 0) {
            echo '[' . date('c') . "] outbox drainé : {$r['processed']} traité(s), {$r['sent']} envoyé(s), {$r['failed']} échec(s)\n";
            Logger::info('worker.drain', $r);
        }
        // À vide (mode démon) : petite pause pour ne pas saturer le CPU.
        if (!$once && $r['processed'] === 0) {
            sleep($idleSleep);
        }
    } catch (\Throwable $e) {
        fwrite(STDERR, '[' . date('c') . '] worker ÉCHEC : ' . $e->getMessage() . "\n");
        Logger::error('worker.failed', ['error' => $e->getMessage()]);
        if ($once) {
            exit(1);
        }
        sleep($idleSleep);
    }
} while (!$once && $running);

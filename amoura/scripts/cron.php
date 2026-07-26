<?php
declare(strict_types=1);

/**
 * Tâches planifiées Amoura (feuille de route — Phase 1).
 * À exécuter via cron, par exemple toutes les 15 minutes :
 *
 *   *\/15 * * * *  php /chemin/amoura/scripts/cron.php >> /chemin/amoura/storage/logs/cron.log 2>&1
 *
 * Purge les statuts expirés, jetons OTP, sessions, rate-limits, etc.
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Services\Logger;
use Amoura\Services\Maintenance;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
require __DIR__ . '/../app/Helpers/functions.php';
Env::load(__DIR__ . '/../.env');
date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'UTC'));

$start = microtime(true);
try {
    $deleted = Maintenance::run();
    $ms = (int) round((microtime(true) - $start) * 1000);
    $summary = implode(', ', array_map(fn($k, $v) => "{$k}={$v}", array_keys($deleted), $deleted));
    echo '[' . date('c') . "] maintenance ok ({$ms} ms) — {$summary}\n";
    Logger::info('cron.maintenance', $deleted + ['duration_ms' => $ms]);
} catch (\Throwable $e) {
    fwrite(STDERR, '[' . date('c') . '] maintenance ÉCHEC : ' . $e->getMessage() . "\n");
    Logger::error('cron.maintenance_failed', ['error' => $e->getMessage()]);
    exit(1);
}

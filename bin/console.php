#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Console Transouscris — utilitaires en ligne de commande.
 *
 * Usage :
 *   php bin/console.php migrate            Applique schema.sql puis seeds.sql
 *   php bin/console.php guarantee:run      Traite les remboursements garantis dus
 *   php bin/console.php scheduled:run      Exécute les recharges programmées dues
 */

use Transouscris\Core\Config;
use Transouscris\Core\Database;
use Transouscris\Core\Env;
use Transouscris\Services\RefundGuaranteeService;

$basePath = dirname(__DIR__);

$composer = $basePath . '/vendor/autoload.php';
if (is_file($composer)) {
    require $composer;
} else {
    spl_autoload_register(static function (string $class) use ($basePath): void {
        $prefix = 'Transouscris\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }
        $file = $basePath . '/app/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($file)) {
            require $file;
        }
    });
}

Env::load($basePath . '/.env');
Config::load($basePath . '/config');
require_once $basePath . '/app/helpers.php';

$command = $argv[1] ?? 'help';

switch ($command) {
    case 'migrate':
        $pdo = Database::connection();
        foreach (['database/schema.sql', 'database/seeds.sql'] as $file) {
            $sql = file_get_contents($basePath . '/' . $file);
            $pdo->exec($sql);
            echo "✔ Exécuté : $file\n";
        }
        echo "Base de données prête.\n";
        break;

    case 'guarantee:run':
        $count = (new RefundGuaranteeService())->processOverdue();
        echo "Garantie : $count recharge(s) remboursée(s).\n";
        break;

    case 'scheduled:run':
        // Point d'extension : parcourir scheduled_recharges dues et déclencher.
        echo "Recharges programmées : à implémenter (voir docs/DEVELOPMENT_PLAN.md, phase 5).\n";
        break;

    default:
        echo "Commandes : migrate | guarantee:run | scheduled:run\n";
}

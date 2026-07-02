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
        $db = Config::get('db');

        // 1) Crée la base si elle n'existe pas (connexion SANS sélection de base).
        try {
            $serverDsn = sprintf('mysql:host=%s;port=%d;charset=%s', $db['host'], $db['port'], $db['charset']);
            $server = new PDO($serverDsn, $db['user'], $db['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $server->exec(sprintf(
                'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
                str_replace('`', '', $db['name'])
            ));
            echo "✔ Base « {$db['name']} » prête (créée si nécessaire).\n";
        } catch (PDOException $e) {
            fwrite(STDERR, "❌ Connexion MySQL impossible : " . $e->getMessage() . "\n");
            fwrite(STDERR, "   Vérifiez DB_HOST/DB_USER/DB_PASS dans votre fichier .env.\n");
            fwrite(STDERR, "   (XAMPP par défaut : DB_USER=root et DB_PASS vide.)\n");
            exit(1);
        }

        // 2) Applique le schéma puis les données de départ (base sélectionnée).
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

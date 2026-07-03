#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Console Transouscris — utilitaires en ligne de commande.
 *
 * Usage :
 *   php bin/console.php migrate            Crée la base si besoin puis applique schema + seeds
 *   php bin/console.php migrate:fresh      ⚠️ Réinitialise la base (drop + recrée) — dev
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

    case 'migrate:fresh':
        // ⚠️ DESTRUCTIF : supprime puis recrée toute la base (utile en dev pour
        // repartir d'un schéma + catalogue à jour).
        $db = Config::get('db');
        $serverDsn = sprintf('mysql:host=%s;port=%d;charset=%s', $db['host'], $db['port'], $db['charset']);
        try {
            $server = new PDO($serverDsn, $db['user'], $db['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $name = str_replace('`', '', $db['name']);
            $server->exec("DROP DATABASE IF EXISTS `$name`");
            $server->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            echo "✔ Base « {$db['name']} » recréée (à vide).\n";
        } catch (PDOException $e) {
            fwrite(STDERR, "❌ Connexion MySQL impossible : " . $e->getMessage() . "\n");
            exit(1);
        }
        $pdo = Database::connection();
        foreach (['database/schema.sql', 'database/seeds.sql'] as $file) {
            $pdo->exec(file_get_contents($basePath . '/' . $file));
            echo "✔ Exécuté : $file\n";
        }
        echo "Base réinitialisée avec le catalogue à jour.\n";
        break;

    case 'guarantee:run':
        $count = (new RefundGuaranteeService())->processOverdue();
        echo "Garantie : $count recharge(s) remboursée(s).\n";
        break;

    case 'scheduled:run':
        $result = (new \Transouscris\Services\ScheduledRechargeService())->runDue();
        echo "Recharges programmées : {$result['executed']} exécutée(s), {$result['skipped']} sautée(s).\n";
        break;

    default:
        echo "Commandes : migrate | migrate:fresh | guarantee:run | scheduled:run\n";
}

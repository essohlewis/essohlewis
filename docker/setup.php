<?php

declare(strict_types=1);

/**
 * Initialisation au démarrage du conteneur :
 *   1. Attend que MySQL soit joignable.
 *   2. Applique le schéma + les données de départ SI la base est vide
 *      (idempotent : ne réexécute pas les migrations à chaque redémarrage).
 *
 * Exécuté par docker/entrypoint.sh avant le lancement d'Apache.
 */

use Transouscris\Core\Config;
use Transouscris\Core\Database;
use Transouscris\Core\Env;

$basePath = dirname(__DIR__);

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

Env::load($basePath . '/.env');
Config::load($basePath . '/config');

// 1) Attente de MySQL (jusqu'à ~60 s).
$pdo = null;
for ($attempt = 1; $attempt <= 30; $attempt++) {
    try {
        $pdo = Database::connection();
        break;
    } catch (\Throwable $e) {
        fwrite(STDOUT, "⏳ MySQL indisponible (tentative $attempt)...\n");
        Database::reset();
        sleep(2);
    }
}

if ($pdo === null) {
    fwrite(STDERR, "❌ Impossible de se connecter à MySQL. Abandon.\n");
    exit(1);
}

// 2) Migration conditionnelle : seulement si la table `users` n'existe pas.
$exists = $pdo->query("SHOW TABLES LIKE 'users'")->fetch();
if ($exists) {
    fwrite(STDOUT, "✔ Base déjà initialisée — migration ignorée.\n");
    exit(0);
}

fwrite(STDOUT, "▶ Initialisation de la base de données...\n");
foreach (['database/schema.sql', 'database/seeds.sql'] as $file) {
    $sql = file_get_contents($basePath . '/' . $file);
    $pdo->exec($sql);
    fwrite(STDOUT, "  ✔ $file\n");
}
fwrite(STDOUT, "✔ Base de données prête.\n");

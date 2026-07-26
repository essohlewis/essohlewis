<?php
declare(strict_types=1);

/**
 * Exécute le schéma SQL puis les données de démarrage.
 * Usage : php scripts/migrate.php [--fresh]
 *   --fresh : supprime et recrée la base (⚠ destructif).
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Env;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
Env::load(__DIR__ . '/../.env');

$host = (string) Env::get('DB_HOST', '127.0.0.1');
$port = (string) Env::get('DB_PORT', '3306');
$name = (string) Env::get('DB_NAME', 'amoura');
$user = (string) Env::get('DB_USER', 'root');
$pass = (string) Env::get('DB_PASS', '');

$fresh = in_array('--fresh', $argv, true);

try {
    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    if ($fresh) {
        $pdo->exec("DROP DATABASE IF EXISTS `{$name}`");
        echo "Base supprimée.\n";
    }
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$name}`");

    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    $pdo->exec($schema);
    echo "Schéma appliqué.\n";

    $seed = file_get_contents(__DIR__ . '/../database/seed.sql');
    $pdo->exec($seed);
    echo "Données de démarrage insérées.\n";

    echo "✅ Migration terminée. Créez un admin : php scripts/make_admin.php admin@amoura.example 'MotDePasse123'\n";
} catch (PDOException $e) {
    fwrite(STDERR, "Erreur : " . $e->getMessage() . "\n");
    exit(1);
}

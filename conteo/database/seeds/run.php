<?php
/**
 * CONTEO — Exécuteur de migrations / seeds (sans dépendance).
 *
 *   php database/seeds/run.php migrate   → applique database/migrations/*.sql
 *   php database/seeds/run.php seed      → applique database/seeds/*.sql
 *
 * Utilise la connexion PDO configurée via .env.
 */

declare(strict_types=1);

require dirname(__DIR__, 2) . '/config/config.php';

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = dirname(__DIR__, 2) . '/app/' . str_replace(['App\\', '\\'], ['', '/'], $class) . '.php';
    if (is_file($file)) require $file;
});

use App\Core\Database;

$mode = $argv[1] ?? 'migrate';
$dir = dirname(__DIR__) . ($mode === 'seed' ? '/seeds' : '/migrations');

$files = glob($dir . '/*.sql') ?: [];
sort($files);

if (!$files) {
    fwrite(STDERR, "Aucun fichier .sql dans $dir\n");
    exit(1);
}

$pdo = Database::connection();

foreach ($files as $file) {
    echo "→ Exécution de " . basename($file) . "\n";
    $sql = file_get_contents($file);
    try {
        $pdo->exec($sql);
        echo "  ✓ OK\n";
    } catch (\PDOException $e) {
        fwrite(STDERR, "  ✗ Erreur : " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "Terminé.\n";

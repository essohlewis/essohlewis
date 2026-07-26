<?php
declare(strict_types=1);

/**
 * Gestion du schéma et des migrations Amoura.
 *
 *   php scripts/migrate.php            # applique les migrations en attente (BDD existante)
 *   php scripts/migrate.php --fresh    # (ré)installe schéma + données puis « baseline » les migrations
 *   php scripts/migrate.php status     # liste les migrations appliquées / en attente
 *
 * Les migrations vivent dans database/migrations/*.sql et sont suivies dans la
 * table schema_migrations (appliquées une seule fois, dans l'ordre des noms).
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

$migrationsDir = __DIR__ . '/../database/migrations';
$fresh  = in_array('--fresh', $argv, true);
$status = in_array('status', $argv, true);

/** @return string[] noms de fichiers de migration, triés. */
function migrationFiles(string $dir): array
{
    if (!is_dir($dir)) {
        return [];
    }
    $files = array_map('basename', glob($dir . '/*.sql') ?: []);
    sort($files);
    return $files;
}

function ensureMigrationsTable(PDO $db): void
{
    $db->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(191) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** @return string[] migrations déjà appliquées. */
function appliedMigrations(PDO $db): array
{
    return $db->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN) ?: [];
}

try {
    // --- Statut : lecture seule -------------------------------------------
    if ($status) {
        $db = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        ensureMigrationsTable($db);
        $applied = appliedMigrations($db);
        foreach (migrationFiles($migrationsDir) as $f) {
            echo (in_array($f, $applied, true) ? '  [x] ' : '  [ ] ') . $f . "\n";
        }
        exit(0);
    }

    // --- Réinstallation complète ------------------------------------------
    if ($fresh) {
        $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->exec("DROP DATABASE IF EXISTS `{$name}`");
        echo "Base supprimée.\n";
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$name}`");
        $pdo->exec(file_get_contents(__DIR__ . '/../database/schema.sql'));
        echo "Schéma appliqué.\n";
        $pdo->exec(file_get_contents(__DIR__ . '/../database/seed.sql'));
        echo "Données de démarrage insérées.\n";

        // Baseline : le schéma reflète déjà toutes les migrations existantes.
        ensureMigrationsTable($pdo);
        $stmt = $pdo->prepare('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)');
        foreach (migrationFiles($migrationsDir) as $f) {
            $stmt->execute([$f]);
        }
        echo "✅ Installation terminée (migrations baselinées).\n";
        echo "   Créez un admin : php scripts/make_admin.php admin@amoura.example 'MotDePasse123'\n";
        exit(0);
    }

    // --- Migration incrémentale (BDD existante) ---------------------------
    $db = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    ensureMigrationsTable($db);
    $applied = appliedMigrations($db);
    $pending = array_values(array_diff(migrationFiles($migrationsDir), $applied));

    if (!$pending) {
        echo "Aucune migration en attente. Base à jour.\n";
        exit(0);
    }

    $insert = $db->prepare('INSERT INTO schema_migrations (filename) VALUES (?)');
    foreach ($pending as $file) {
        echo "→ Application de {$file}… ";
        $sql = file_get_contents($migrationsDir . '/' . $file);
        $db->beginTransaction();
        try {
            $db->exec($sql);
            $insert->execute([$file]);
            $db->commit();
            echo "ok\n";
        } catch (\Throwable $e) {
            // Le DDL n'est pas transactionnel sous MySQL : on remonte l'erreur clairement.
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw new RuntimeException("Échec de {$file} : " . $e->getMessage(), 0, $e);
        }
    }
    echo "✅ " . count($pending) . " migration(s) appliquée(s).\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Erreur : ' . $e->getMessage() . "\n");
    exit(1);
}

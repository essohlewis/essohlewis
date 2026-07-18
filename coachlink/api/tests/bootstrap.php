<?php
/* ==========================================================================
   tests/bootstrap.php — Amorçage des tests : app en mode SQLite isolé
   (base temporaire), sans en-têtes HTTP. Charge la classe de base ApiTestCase.
   ========================================================================== */

require __DIR__ . '/../core/App.php';

$tmp = sys_get_temp_dir() . '/coachlink-test-' . getmypid();
@mkdir($tmp, 0775, true);
$dbPath = $tmp . '/test.sqlite';
@unlink($dbPath);

App::boot([
    'db'           => ['driver' => 'sqlite', 'sqlite_path' => $dbPath],
    'jwt_secret'   => 'secret-de-test-suffisamment-long-1234567890',
    'jwt_ttl'      => 3600,
    'cors_origins' => ['*'],
    'uploads_dir'  => $tmp . '/uploads',
    'uploads_url'  => '/uploads',
    'max_upload'   => 8 * 1024 * 1024,
    'rate_limit'   => ['global' => 100000, 'auth' => 100000],
    'cache_dir'    => $tmp . '/cache',
], false); // http = false → aucun envoi d'en-têtes

require __DIR__ . '/../database/ddl.php';
coachlink_creer_tables(Database::connexion(), true);

require __DIR__ . '/ApiTestCase.php';

// Nettoyage best-effort en fin de processus.
register_shutdown_function(function () use ($tmp) {
    foreach (['', '/uploads', '/cache/ratelimit'] as $sous) {
        foreach (glob($tmp . $sous . '/*') ?: [] as $f) {
            if (is_file($f)) @unlink($f);
        }
    }
});

<?php
declare(strict_types=1);

/**
 * Test de charge HTTP (Phase 1, Sprint +8).
 * Envoie des requêtes concurrentes sur un jeu d'URL, mesure les latences
 * (p50/p95/p99), le débit et le taux d'erreur, puis compare au budget de
 * performance. Code de sortie ≠ 0 si le budget est dépassé (exploitable en CI).
 *
 *   php scripts/loadtest.php --base=http://localhost:8080 --requests=300 --concurrency=30
 *   php scripts/loadtest.php --paths=/,/login,/api/discover
 *
 * Options :
 *   --base=URL          origine à tester (défaut : APP_URL ou http://localhost:8080)
 *   --requests=N        nombre total de requêtes (défaut : 200)
 *   --concurrency=N     requêtes simultanées (défaut : 20)
 *   --paths=a,b,c       chemins à solliciter (défaut : section « http » du budget)
 *   --budget=fichier    budget JSON (défaut : perf-budget.json)
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Core\Benchmark\Budget;
use Amoura\Core\Benchmark\Metrics;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
@Env::load(__DIR__ . '/../.env');

/** Lit une option --clé=valeur. */
function opt(string $name, ?string $default = null): ?string
{
    foreach ($GLOBALS['argv'] as $arg) {
        if (str_starts_with($arg, "--{$name}=")) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

if (!function_exists('curl_multi_init')) {
    fwrite(STDERR, "L'extension cURL est requise pour le test de charge.\n");
    exit(2);
}

$base = rtrim((string) opt('base', (string) Env::get('APP_URL', 'http://localhost:8080')), '/');
$total = max(1, (int) opt('requests', '200'));
$concurrency = max(1, (int) opt('concurrency', '20'));
$budgetFile = (string) opt('budget', __DIR__ . '/../perf-budget.json');

$budget = is_file($budgetFile) ? (json_decode((string) file_get_contents($budgetFile), true) ?: []) : [];
$httpBudget = $budget['http'] ?? [];

$pathsOpt = opt('paths');
$paths = $pathsOpt !== null
    ? array_filter(array_map('trim', explode(',', $pathsOpt)))
    : ($httpBudget['paths'] ?? ['/']);
$paths = array_values($paths);

echo "🏋️  Test de charge HTTP → {$base}\n";
echo "    {$total} requêtes · concurrence {$concurrency} · chemins : " . implode(', ', $paths) . "\n\n";

$latencies = [];   // ms
$errors = 0;
$statusTally = [];
$done = 0;

$mh = curl_multi_init();
$active = [];

/** Prépare un handle cURL vers un chemin donné. */
$makeHandle = function (string $path) use ($base): \CurlHandle {
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,      // 302 auth = réponse valide, pas une erreur
        CURLOPT_USERAGENT => 'Amoura-LoadTest/1.0',
    ]);
    return $ch;
};

$queued = 0;
$start = microtime(true);

// Amorce la fenêtre de concurrence.
for ($i = 0; $i < min($concurrency, $total); $i++) {
    $ch = $makeHandle($paths[$queued % count($paths)]);
    curl_multi_add_handle($mh, $ch);
    $active[(int) $ch] = $ch;
    $queued++;
}

do {
    curl_multi_exec($mh, $running);
    curl_multi_select($mh, 0.5);

    while ($info = curl_multi_info_read($mh)) {
        $ch = $info['handle'];
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $timeMs = (float) curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000;
        $transportErr = $info['result'] !== CURLE_OK;

        $latencies[] = $timeMs;
        $statusTally[$code] = ($statusTally[$code] ?? 0) + 1;
        if ($transportErr || $code === 0 || $code >= 500) {
            $errors++;
        }
        $done++;

        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        unset($active[(int) $ch]);

        // Réalimente tant qu'il reste des requêtes à lancer.
        if ($queued < $total) {
            $next = $makeHandle($paths[$queued % count($paths)]);
            curl_multi_add_handle($mh, $next);
            $active[(int) $next] = $next;
            $queued++;
        }
    }
} while ($done < $total && ($running > 0 || $queued < $total || !empty($active)));

curl_multi_close($mh);

$elapsed = microtime(true) - $start;
$summary = Metrics::summarize($latencies);
$errorRate = $done > 0 ? $errors / $done : 0.0;
$throughput = $elapsed > 0 ? $done / $elapsed : 0.0;

// ── Rapport ──────────────────────────────────────────────────────────────
printf("Requêtes    : %d en %.2f s  (%.1f req/s)\n", $done, $elapsed, $throughput);
printf("Latence ms  : min %.1f · moy %.1f · p50 %.1f · p95 %.1f · p99 %.1f · max %.1f\n",
    $summary['min'], $summary['mean'], $summary['p50'], $summary['p95'], $summary['p99'], $summary['max']);
$statusStr = implode(' ', array_map(fn($k, $v) => "{$k}×{$v}", array_keys($statusTally), $statusTally));
printf("Statuts     : %s\n", $statusStr);
printf("Erreurs     : %d  (%.2f %%)\n\n", $errors, $errorRate * 100);

$thresholds = $httpBudget['thresholds'] ?? [];
if (!$thresholds) {
    echo "ℹ️  Aucun seuil de budget défini (section http.thresholds) — rapport seul.\n";
    exit(0);
}

$verdict = Budget::evaluate($summary, $errorRate, $thresholds);
echo "Budget de performance :\n";
foreach ($verdict['checks'] as $c) {
    printf("  %s %-16s limite %-10.3f · mesuré %.3f\n",
        $c['pass'] ? '✅' : '❌', $c['metric'], $c['limit'], $c['actual']);
}
echo "\n" . ($verdict['pass'] ? "✅ Budget respecté.\n" : "❌ Budget dépassé.\n");
exit($verdict['pass'] ? 0 : 1);

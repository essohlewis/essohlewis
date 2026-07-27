<?php
declare(strict_types=1);

namespace Amoura\Core\Observability;

use Amoura\Core\Cache\Cache;
use Amoura\Core\Database;
use Amoura\Core\Env;

/**
 * Sonde de santé (Phase 6, Sprint +13).
 *  - liveness (shallow) : le process répond (aucune dépendance).
 *  - readiness (deep)   : dépendances joignables (BDD, cache, disque).
 * Statut global : ok si tout passe, « degraded » si un composant non critique
 * est en panne, « unhealthy » si une dépendance critique (BDD) est indisponible.
 */
final class HealthCheck
{
    /**
     * @return array{status:string, checks:array<string,array{ok:bool,critical:bool,detail?:string}>, duration_ms:float}
     */
    public static function run(bool $deep = true): array
    {
        $start = microtime(true);
        $checks = [];

        if ($deep) {
            $checks['database'] = self::critical(static function (): void {
                Database::connection()->query('SELECT 1')->fetchColumn();
            });
            $checks['cache'] = self::optional(static function (): string {
                if (strtolower((string) Env::get('CACHE_DRIVER', 'array')) !== 'redis') {
                    return 'array (local)';
                }
                $probe = 'health:' . bin2hex(random_bytes(4));
                Cache::set($probe, '1', 5);
                $ok = Cache::get($probe) === '1';
                Cache::forget($probe);
                if (!$ok) {
                    throw new \RuntimeException('lecture/écriture cache KO');
                }
                return 'redis';
            });
            $checks['storage'] = self::optional(static function (): string {
                $dir = dirname(__DIR__, 3) . '/storage/logs';
                if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
                    throw new \RuntimeException('répertoire de logs absent');
                }
                if (!is_writable($dir)) {
                    throw new \RuntimeException('répertoire de logs non inscriptible');
                }
                return 'writable';
            });
        }

        // Statut global.
        $status = 'ok';
        foreach ($checks as $c) {
            if (!$c['ok']) {
                $status = $c['critical'] ? 'unhealthy' : 'degraded';
                if ($c['critical']) {
                    break;
                }
            }
        }

        return [
            'status' => $status,
            'checks' => $checks,
            'duration_ms' => round((microtime(true) - $start) * 1000, 2),
        ];
    }

    /** @param callable():(void|string) $probe */
    private static function critical(callable $probe): array
    {
        return self::probe($probe, true);
    }

    /** @param callable():(void|string) $probe */
    private static function optional(callable $probe): array
    {
        return self::probe($probe, false);
    }

    /** @param callable():(void|string) $probe */
    private static function probe(callable $probe, bool $critical): array
    {
        try {
            $detail = $probe();
            $result = ['ok' => true, 'critical' => $critical];
            if (is_string($detail) && $detail !== '') {
                $result['detail'] = $detail;
            }
            return $result;
        } catch (\Throwable $e) {
            return ['ok' => false, 'critical' => $critical, 'detail' => $e->getMessage()];
        }
    }
}

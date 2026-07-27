<?php
declare(strict_types=1);

namespace Amoura\Core\Benchmark;

/**
 * Évaluation d'un budget de performance (Phase 1, Sprint +8).
 * Compare une synthèse de latences + un taux d'erreur à des seuils, et rend un
 * verdict pass/fail par contrôle. Pure : exploitable en CI (code de sortie ≠ 0).
 */
final class Budget
{
    /**
     * @param array{p50?:float,p95?:float,p99?:float,mean?:float,max?:float} $summary  latences (ms)
     * @param float $errorRate  taux d'erreur observé dans [0,1]
     * @param array{max_p95_ms?:float,max_p99_ms?:float,max_mean_ms?:float,max_error_rate?:float} $thresholds
     * @return array{pass:bool, checks:array<int,array{metric:string,limit:float,actual:float,pass:bool}>}
     */
    public static function evaluate(array $summary, float $errorRate, array $thresholds): array
    {
        $checks = [];

        $map = [
            'max_p95_ms'     => ['p95 (ms)',  $summary['p95'] ?? 0.0],
            'max_p99_ms'     => ['p99 (ms)',  $summary['p99'] ?? 0.0],
            'max_mean_ms'    => ['moyenne (ms)', $summary['mean'] ?? 0.0],
        ];
        foreach ($map as $key => [$label, $actual]) {
            if (isset($thresholds[$key])) {
                $limit = (float) $thresholds[$key];
                $checks[] = ['metric' => $label, 'limit' => $limit, 'actual' => (float) $actual, 'pass' => $actual <= $limit];
            }
        }
        if (isset($thresholds['max_error_rate'])) {
            $limit = (float) $thresholds['max_error_rate'];
            $checks[] = ['metric' => 'taux d\'erreur', 'limit' => $limit, 'actual' => $errorRate, 'pass' => $errorRate <= $limit];
        }

        $pass = true;
        foreach ($checks as $c) {
            $pass = $pass && $c['pass'];
        }
        return ['pass' => $pass, 'checks' => $checks];
    }
}

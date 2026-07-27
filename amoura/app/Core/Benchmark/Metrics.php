<?php
declare(strict_types=1);

namespace Amoura\Core\Benchmark;

/**
 * Statistiques de latence pour les tests de charge (Phase 1, Sprint +8).
 * Logique pure (aucune I/O) : synthétise une série de mesures en millisecondes.
 */
final class Metrics
{
    /**
     * Percentile par interpolation linéaire entre rangs (méthode « linear »).
     * @param float[] $sorted valeurs TRIÉES croissantes
     * @param float   $p      percentile dans [0,100]
     */
    public static function percentile(array $sorted, float $p): float
    {
        $n = count($sorted);
        if ($n === 0) {
            return 0.0;
        }
        if ($n === 1) {
            return (float) $sorted[0];
        }
        $p = max(0.0, min(100.0, $p));
        $rank = ($p / 100) * ($n - 1);      // position 0-indexée
        $low = (int) floor($rank);
        $high = (int) ceil($rank);
        if ($low === $high) {
            return (float) $sorted[$low];
        }
        $frac = $rank - $low;
        return $sorted[$low] + ($sorted[$high] - $sorted[$low]) * $frac;
    }

    /**
     * Synthèse d'une série de latences (ms).
     * @param float[] $samples
     * @return array{count:int,min:float,max:float,mean:float,p50:float,p90:float,p95:float,p99:float}
     */
    public static function summarize(array $samples): array
    {
        $samples = array_values(array_map('floatval', $samples));
        $count = count($samples);
        if ($count === 0) {
            return ['count' => 0, 'min' => 0.0, 'max' => 0.0, 'mean' => 0.0,
                    'p50' => 0.0, 'p90' => 0.0, 'p95' => 0.0, 'p99' => 0.0];
        }
        sort($samples, SORT_NUMERIC);
        return [
            'count' => $count,
            'min' => (float) $samples[0],
            'max' => (float) $samples[$count - 1],
            'mean' => array_sum($samples) / $count,
            'p50' => self::percentile($samples, 50),
            'p90' => self::percentile($samples, 90),
            'p95' => self::percentile($samples, 95),
            'p99' => self::percentile($samples, 99),
        ];
    }
}

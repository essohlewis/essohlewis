<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Benchmark\Budget;
use Amoura\Core\Benchmark\Metrics;
use PHPUnit\Framework\TestCase;

/** Statistiques de latence et budget de performance (Phase 1, Sprint +8). */
final class BenchmarkTest extends TestCase
{
    public function testSummarizeKnownSeries(): void
    {
        $s = Metrics::summarize([50, 20, 40, 10, 30]); // désordonné exprès
        $this->assertSame(5, $s['count']);
        $this->assertSame(10.0, $s['min']);
        $this->assertSame(50.0, $s['max']);
        $this->assertSame(30.0, $s['mean']);
        $this->assertSame(30.0, $s['p50']);            // médiane
        // Interpolation linéaire (rang 0-indexé) : p95 = idx3 + 0.8·(idx4-idx3).
        $this->assertEqualsWithDelta(48.0, $s['p95'], 0.001);
        $this->assertEqualsWithDelta(49.6, $s['p99'], 0.001);
    }

    public function testEmptySeriesIsZeroed(): void
    {
        $s = Metrics::summarize([]);
        $this->assertSame(0, $s['count']);
        $this->assertSame(0.0, $s['p95']);
    }

    public function testPercentileBounds(): void
    {
        $sorted = [1.0, 2.0, 3.0, 4.0];
        $this->assertSame(1.0, Metrics::percentile($sorted, 0));
        $this->assertSame(4.0, Metrics::percentile($sorted, 100));
        $this->assertSame(5.0, Metrics::percentile([5.0], 95)); // singleton
    }

    public function testBudgetPasses(): void
    {
        $summary = ['p95' => 180.0, 'p99' => 400.0, 'mean' => 90.0];
        $v = Budget::evaluate($summary, 0.005, [
            'max_p95_ms' => 400, 'max_p99_ms' => 800, 'max_mean_ms' => 200, 'max_error_rate' => 0.01,
        ]);
        $this->assertTrue($v['pass']);
        $this->assertCount(4, $v['checks']);
    }

    public function testBudgetFailsOnBreachedMetric(): void
    {
        $summary = ['p95' => 900.0, 'p99' => 400.0, 'mean' => 90.0];
        $v = Budget::evaluate($summary, 0.0, ['max_p95_ms' => 400]);
        $this->assertFalse($v['pass']);
        $this->assertFalse($v['checks'][0]['pass']);
    }

    public function testBudgetFailsOnErrorRate(): void
    {
        $v = Budget::evaluate(['p95' => 10.0], 0.05, ['max_error_rate' => 0.01]);
        $this->assertFalse($v['pass']);
    }

    public function testBudgetIgnoresUnsetThresholds(): void
    {
        // Aucun seuil → aucun contrôle → succès trivial.
        $v = Budget::evaluate(['p95' => 9999.0], 1.0, []);
        $this->assertTrue($v['pass']);
        $this->assertCount(0, $v['checks']);
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Observability\HealthCheck;
use Amoura\Core\Observability\Metrics;

/** Sonde de santé & jauges applicatives (Phase 6, Sprint +13). */
final class HealthCheckTest extends IntegrationTestCase
{
    public function testDeepCheckIsHealthyWhenDependenciesUp(): void
    {
        $report = HealthCheck::run(true);

        $this->assertSame('ok', $report['status']);
        $this->assertTrue($report['checks']['database']['ok']);
        $this->assertTrue($report['checks']['database']['critical']);
        $this->assertArrayHasKey('storage', $report['checks']);
        $this->assertGreaterThanOrEqual(0.0, $report['duration_ms']);
    }

    public function testShallowCheckHasNoDependencyProbes(): void
    {
        $report = HealthCheck::run(false);
        $this->assertSame('ok', $report['status']);
        $this->assertSame([], $report['checks']);
    }

    public function testAppGaugesRenderFromDatabase(): void
    {
        // Un utilisateur en ligne → la jauge doit refléter la base.
        $uid = $this->makeUser('online@test.io');
        $this->db->exec("UPDATE users SET is_online = 1 WHERE id = {$uid}");

        Metrics::reset();
        Metrics::collectAppGauges();
        $out = Metrics::render();

        $this->assertStringContainsString('amoura_users_online 1', $out);
        $this->assertStringContainsString('# TYPE amoura_active_subscriptions gauge', $out);
        $this->assertStringContainsString('amoura_outbox_pending 0', $out);
    }
}

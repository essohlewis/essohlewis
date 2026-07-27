<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Observability\Metrics;
use Amoura\Core\Observability\RequestContext;
use PHPUnit\Framework\TestCase;

/** Contexte de requête + registre de métriques (Phase 6, Sprint +13). */
final class ObservabilityTest extends TestCase
{
    protected function setUp(): void
    {
        RequestContext::reset();
        Metrics::reset();
    }

    public function testGeneratesUuidV4WhenNoIncoming(): void
    {
        $id = RequestContext::begin(null);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $id
        );
        $this->assertTrue(RequestContext::started());
        $this->assertSame($id, RequestContext::id(), 'id stable après begin');
    }

    public function testReusesPlausibleIncomingId(): void
    {
        $this->assertSame('trace-abc_123.45', RequestContext::begin('trace-abc_123.45'));
    }

    public function testRejectsImplausibleIncomingId(): void
    {
        // Trop court / caractères interdits → identifiant généré à la place.
        $id = RequestContext::begin('bad id!');
        $this->assertNotSame('bad id!', $id);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $id);
    }

    public function testDurationIsPositiveAfterBegin(): void
    {
        RequestContext::begin();
        usleep(1000);
        $this->assertGreaterThan(0.0, RequestContext::durationMs());
    }

    public function testCounterAndGaugeRenderInPrometheusFormat(): void
    {
        Metrics::inc('amoura_test_total', ['route' => 'a'], 1, 'Compteur de test');
        Metrics::inc('amoura_test_total', ['route' => 'a']);
        Metrics::inc('amoura_test_total', ['route' => 'b']);
        Metrics::gauge('amoura_test_gauge', 42.5, [], 'Jauge de test');

        $out = Metrics::render();
        $this->assertStringContainsString('# TYPE amoura_test_total counter', $out);
        $this->assertStringContainsString('# HELP amoura_test_total Compteur de test', $out);
        $this->assertStringContainsString('amoura_test_total{route="a"} 2', $out);
        $this->assertStringContainsString('amoura_test_total{route="b"} 1', $out);
        $this->assertStringContainsString('# TYPE amoura_test_gauge gauge', $out);
        $this->assertStringContainsString('amoura_test_gauge 42.5', $out);
    }

    public function testLabelsAreOrderStable(): void
    {
        // L'ordre d'insertion des étiquettes ne change pas la série (tri par clé).
        Metrics::inc('m', ['b' => 2, 'a' => 1]);
        Metrics::inc('m', ['a' => 1, 'b' => 2]);
        $out = Metrics::render();
        $this->assertStringContainsString('m{a="1",b="2"} 2', $out);
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Transouscris\Services\OperatorDetector;

final class OperatorDetectorTest extends TestCase
{
    private OperatorDetector $detector;

    protected function setUp(): void
    {
        $this->detector = new OperatorDetector();
    }

    public function test_normalise_les_formats_courants(): void
    {
        $this->assertSame('0700000000', $this->detector->normalize('0700000000'));
        $this->assertSame('0700000000', $this->detector->normalize('07 00 00 00 00'));
        $this->assertSame('0700000000', $this->detector->normalize('+2250700000000'));
        $this->assertSame('0700000000', $this->detector->normalize('002250700000000'));
    }

    public function test_rejette_les_numeros_invalides(): void
    {
        $this->assertNull($this->detector->normalize('123'));
        $this->assertNull($this->detector->normalize('070000000')); // 9 chiffres
    }

    public function test_detecte_l_operateur_par_prefixe(): void
    {
        $this->assertSame('orange', $this->detector->detect('0700000000')['operator']);
        $this->assertSame('moov',   $this->detector->detect('0100000000')['operator']);
        $this->assertSame('mtn',    $this->detector->detect('0500000000')['operator']);
    }

    public function test_la_detection_par_prefixe_n_est_pas_faisant_autorite(): void
    {
        $result = $this->detector->detect('0700000000');
        $this->assertFalse($result['authoritative']);
    }

    public function test_le_resolveur_hlr_prime_sur_le_prefixe(): void
    {
        // Simule une portabilité : un 07 (Orange par préfixe) réellement MTN.
        $detector = new OperatorDetector(fn (string $msisdn) => 'mtn');
        $result   = $detector->detect('0700000000');
        $this->assertSame('mtn', $result['operator']);
        $this->assertTrue($result['authoritative']);
    }

    public function test_format_e164(): void
    {
        $this->assertSame('2250700000000', $this->detector->toE164('0700000000'));
    }
}

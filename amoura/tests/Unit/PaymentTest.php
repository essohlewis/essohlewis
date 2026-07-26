<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Payment\CinetPayGateway;
use Amoura\Services\Payment\GatewayFactory;
use Amoura\Services\Payment\PaypalGateway;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PaymentTest extends TestCase
{
    /** Détection de l'opérateur Mobile Money par préfixe (Côte d'Ivoire). */
    #[DataProvider('operatorProvider')]
    public function testOperatorDetection(string $phone, string $expected): void
    {
        $this->assertSame($expected, CinetPayGateway::operatorFromPhone($phone));
    }

    public static function operatorProvider(): array
    {
        return [
            'Orange 07'      => ['0707000000', 'orange_money'],
            'MTN 05'         => ['0505000000', 'mtn_money'],
            'Moov 01'        => ['0101000000', 'moov_money'],
            'avec indicatif' => ['+2250707123456', 'orange_money'],
            'inconnu'        => ['0909000000', 'mobile_money'],
        ];
    }

    public function testFactoryExposesExpectedGateways(): void
    {
        // On vérifie le catalogue sans instancier (les passerelles se connectent à la BDD).
        $this->assertSame(['stripe', 'paypal', 'cinetpay', 'paydunya'], GatewayFactory::available());
    }

    public function testFactoryRejectsUnknownGateway(): void
    {
        // match() lève l'exception avant toute instanciation de passerelle.
        $this->expectException(\InvalidArgumentException::class);
        GatewayFactory::make('bitcoin-magique');
    }

    public function testPaypalHeaderNormalizationIsCaseInsensitive(): void
    {
        $normalized = PaypalGateway::normalizeHeaders([
            'PayPal-Transmission-Id' => 'abc',
            'PAYPAL-CERT-URL' => 'https://x',
        ]);
        $this->assertSame('abc', $normalized['paypal-transmission-id']);
        $this->assertSame('https://x', $normalized['paypal-cert-url']);
    }
}

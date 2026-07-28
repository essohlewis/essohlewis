<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Services\Payment\GatewayFactory;
use Amoura\Services\Payment\MpesaGateway;

/**
 * Passerelle M-Pesa (Phase 5, Sprint +21) : enregistrement dans la fabrique et
 * politique du webhook. Daraja ne signe pas le callback : verifyWebhookSignature
 * renvoie true et la confirmation réelle passe par verify() (re-vérification
 * serveur via stkpushquery), jamais par le corps du callback.
 */
final class MpesaWebhookTest extends IntegrationTestCase
{
    public function testRegisteredInFactory(): void
    {
        $this->assertContains('mpesa', GatewayFactory::available());
        $this->assertInstanceOf(MpesaGateway::class, GatewayFactory::make('mpesa'));
    }

    public function testWebhookSignatureAlwaysAcceptedButReverified(): void
    {
        $gateway = new MpesaGateway();
        // Le callback n'est pas signé : on ne bloque pas sur la signature…
        $this->assertTrue($gateway->verifyWebhookSignature('{}', []));
        $this->assertTrue($gateway->verifyWebhookSignature('nimportequoi', ['X-Foo' => 'bar']));
        // … mais la source de vérité reste verify() (stkpushquery côté serveur).
    }
}

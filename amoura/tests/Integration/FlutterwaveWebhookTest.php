<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Setting;
use Amoura\Services\Payment\FlutterwaveGateway;
use Amoura\Services\Payment\GatewayFactory;

/**
 * Passerelle Flutterwave (Phase 5, Sprint +19) : validation « fail-closed » du
 * webhook via l'en-tête « verif-hash », insensible à la casse du nom d'en-tête.
 */
final class FlutterwaveWebhookTest extends IntegrationTestCase
{
    public function testRegisteredInFactory(): void
    {
        $this->assertContains('flutterwave', GatewayFactory::available());
        $this->assertInstanceOf(FlutterwaveGateway::class, GatewayFactory::make('flutterwave'));
    }

    public function testRejectsWhenHashNotConfigured(): void
    {
        // Aucun hash configuré → refus par prudence (fail-closed).
        $gateway = new FlutterwaveGateway(new Setting());
        $this->assertFalse($gateway->verifyWebhookSignature('{}', ['verif-hash' => 'anything']));
    }

    public function testAcceptsMatchingHashCaseInsensitiveHeader(): void
    {
        (new Setting())->set('flutterwave_secret_hash', 'topsecret-hash');
        $gateway = new FlutterwaveGateway(new Setting());

        $this->assertTrue($gateway->verifyWebhookSignature('{}', ['verif-hash' => 'topsecret-hash']));
        // Le nom d'en-tête peut arriver dans une casse différente.
        $this->assertTrue($gateway->verifyWebhookSignature('{}', ['Verif-Hash' => 'topsecret-hash']));
    }

    public function testRejectsWrongOrMissingHash(): void
    {
        (new Setting())->set('flutterwave_secret_hash', 'topsecret-hash');
        $gateway = new FlutterwaveGateway(new Setting());

        $this->assertFalse($gateway->verifyWebhookSignature('{}', ['verif-hash' => 'mauvais']));
        $this->assertFalse($gateway->verifyWebhookSignature('{}', []));
    }
}

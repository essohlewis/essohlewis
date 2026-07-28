<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Setting;
use Amoura\Services\Payment\GatewayFactory;
use Amoura\Services\Payment\WaveGateway;

/**
 * Passerelle Wave (Phase 5, Sprint +20) : validation de la signature HMAC du
 * webhook (en-tête « Wave-Signature: t=…, v1=… »), fail-closed.
 */
final class WaveWebhookTest extends IntegrationTestCase
{
    private const SECRET = 'wave-webhook-secret';

    /** Construit un en-tête Wave-Signature valide pour un corps donné. */
    private function sign(string $payload, string $timestamp = '1700000000'): string
    {
        $sig = hash_hmac('sha256', $timestamp . $payload, self::SECRET);
        return "t={$timestamp}, v1={$sig}";
    }

    public function testRegisteredInFactory(): void
    {
        $this->assertContains('wave', GatewayFactory::available());
        $this->assertInstanceOf(WaveGateway::class, GatewayFactory::make('wave'));
    }

    public function testRejectsWhenSecretNotConfigured(): void
    {
        $gateway = new WaveGateway(new Setting());
        $this->assertFalse($gateway->verifyWebhookSignature('{}', ['Wave-Signature' => $this->sign('{}')]));
    }

    public function testAcceptsValidSignature(): void
    {
        (new Setting())->set('wave_webhook_secret', self::SECRET);
        $gateway = new WaveGateway(new Setting());
        $payload = '{"type":"checkout.session.completed","data":{"id":"cos-1"}}';

        $this->assertTrue($gateway->verifyWebhookSignature($payload, ['Wave-Signature' => $this->sign($payload)]));
        // Nom d'en-tête insensible à la casse.
        $this->assertTrue($gateway->verifyWebhookSignature($payload, ['wave-signature' => $this->sign($payload)]));
    }

    public function testRejectsTamperedPayloadOrBadSignature(): void
    {
        (new Setting())->set('wave_webhook_secret', self::SECRET);
        $gateway = new WaveGateway(new Setting());
        $header = $this->sign('{"a":1}');

        // Corps modifié après signature → rejet.
        $this->assertFalse($gateway->verifyWebhookSignature('{"a":2}', ['Wave-Signature' => $header]));
        // Signature bidon / en-tête mal formé → rejet.
        $this->assertFalse($gateway->verifyWebhookSignature('{"a":1}', ['Wave-Signature' => 't=1, v1=deadbeef']));
        $this->assertFalse($gateway->verifyWebhookSignature('{"a":1}', ['Wave-Signature' => 'nimportequoi']));
        $this->assertFalse($gateway->verifyWebhookSignature('{"a":1}', []));
    }
}

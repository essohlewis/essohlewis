<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Setting;
use Amoura\Services\Payment\PaypalGateway;

/**
 * Vérifie le comportement « fail-closed » de la validation de webhook PayPal :
 * sans configuration ou sans en-têtes de transmission, la signature est rejetée
 * (aucun appel réseau n'est nécessaire pour ces cas).
 */
final class PaypalWebhookTest extends IntegrationTestCase
{
    private array $validHeaders = [
        'Paypal-Transmission-Id'   => 'tid',
        'Paypal-Transmission-Time' => '2026-07-26T00:00:00Z',
        'Paypal-Transmission-Sig'  => 'sig',
        'Paypal-Cert-Url'          => 'https://api.paypal.com/cert',
        'Paypal-Auth-Algo'         => 'SHA256withRSA',
    ];

    public function testRejectsWhenWebhookIdNotConfigured(): void
    {
        // Le seed laisse paypal_webhook_id vide → refus immédiat.
        $gateway = new PaypalGateway(new Setting());
        $this->assertFalse($gateway->verifyWebhookSignature('{"event_type":"x"}', $this->validHeaders));
    }

    public function testRejectsWhenTransmissionHeadersMissing(): void
    {
        (new Setting())->set('paypal_webhook_id', 'WH-123');
        $gateway = new PaypalGateway(new Setting());
        // En-têtes vides malgré une config présente → refus avant tout appel réseau.
        $this->assertFalse($gateway->verifyWebhookSignature('{"event_type":"x"}', []));
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use Transouscris\Core\Config;

/**
 * Intégration Wave (Checkout API). Fournisseur optionnel : l'implémentation
 * suit le même contrat et peut être activée sans toucher au code métier.
 *
 * Wave signe ses webhooks avec un en-tête `Wave-Signature` (HMAC-SHA256).
 */
final class WaveGateway extends AbstractGateway
{
    private array $cfg;

    public function __construct(?array $config = null)
    {
        $this->cfg = $config ?? Config::get('payments.wave');
    }

    public function name(): string
    {
        return 'wave';
    }

    public function initialize(PaymentContext $ctx): GatewayInitResult
    {
        $res = $this->http(
            'POST',
            $this->cfg['base_url'] . '/checkout/sessions',
            [
                'amount'          => (string) $ctx->amount,
                'currency'        => $ctx->currency,
                'client_reference'=> $ctx->reference,
                'success_url'     => $ctx->returnUrl,
                'error_url'       => $ctx->returnUrl,
            ],
            ['Authorization: Bearer ' . $this->cfg['api_key']]
        );
        $body = $res['body'];

        if (isset($body['wave_launch_url'])) {
            return GatewayInitResult::ok(
                redirectUrl: $body['wave_launch_url'],
                token: $body['id'] ?? null,
                providerTxnId: $body['id'] ?? null,
                raw: $body
            );
        }
        return GatewayInitResult::fail($body['message'] ?? 'Échec initialisation Wave', $body);
    }

    public function verify(string $reference, ?string $providerTransactionId = null): GatewayVerification
    {
        $id = $providerTransactionId ?: $reference;
        $res = $this->http(
            'GET',
            $this->cfg['base_url'] . '/checkout/sessions/' . rawurlencode($id),
            [],
            ['Authorization: Bearer ' . $this->cfg['api_key']]
        );
        $body = $res['body'];

        $status = match ((string) ($body['payment_status'] ?? '')) {
            'succeeded' => PaymentStatus::SUCCESS,
            'cancelled' => PaymentStatus::CANCELLED,
            'expired'   => PaymentStatus::EXPIRED,
            default     => PaymentStatus::PENDING,
        };

        return new GatewayVerification(
            status: $status,
            providerTransactionId: $id,
            amount: (int) round((float) ($body['amount'] ?? 0)),
            currency: (string) ($body['currency'] ?? 'XOF'),
            raw: $body
        );
    }

    public function verifyWebhookSignature(string $rawBody, array $headers): bool
    {
        $sig = $headers['wave-signature'] ?? null;
        if (!is_string($sig) || $sig === '') {
            return false;
        }
        $expected = hash_hmac('sha256', $rawBody, (string) $this->cfg['api_key']);
        return hash_equals($expected, $sig);
    }

    public function parseWebhook(array $payload): WebhookEvent
    {
        $data = $payload['data'] ?? $payload;
        return new WebhookEvent(
            reference: (string) ($data['client_reference'] ?? ''),
            providerTransactionId: $data['id'] ?? null,
            announcedStatus: null,
            raw: $payload
        );
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use Transouscris\Core\Config;

/**
 * Intégration CinetPay Checkout (v2).
 *
 *  - initialize : POST {base}/payment  → payment_url + payment_token
 *  - verify     : POST {base}/payment/check → statut réel de la transaction
 *  - webhook    : signature HMAC-SHA256 dans l'en-tête x-token, calculée sur la
 *                 concaténation ordonnée des champs du POST (clé = secret_key).
 *
 * Documentation : https://docs.cinetpay.com — les noms de champs suivent l'API v2.
 */
final class CinetPayGateway extends AbstractGateway
{
    private array $cfg;

    public function __construct(?array $config = null)
    {
        $this->cfg = $config ?? Config::get('payments.cinetpay');
    }

    public function name(): string
    {
        return 'cinetpay';
    }

    public function initialize(PaymentContext $ctx): GatewayInitResult
    {
        $payload = [
            'apikey'          => $this->cfg['api_key'],
            'site_id'         => $this->cfg['site_id'],
            'transaction_id'  => $ctx->reference,
            'amount'          => $ctx->amount,
            'currency'        => $ctx->currency,
            'description'     => $ctx->description,
            'notify_url'      => $ctx->notifyUrl ?? $this->cfg['notify_url'],
            'return_url'      => $ctx->returnUrl ?? $this->cfg['return_url'],
            'channels'        => 'ALL',
            'customer_phone_number' => $ctx->customerPhone,
            'customer_name'   => $ctx->customerName ?? '',
        ];

        $res = $this->http('POST', $this->cfg['base_url'] . '/payment', $payload);
        $body = $res['body'];

        if (($body['code'] ?? null) === '201' && isset($body['data']['payment_url'])) {
            return GatewayInitResult::ok(
                redirectUrl: $body['data']['payment_url'],
                token: $body['data']['payment_token'] ?? null,
                providerTxnId: $ctx->reference,
                raw: $body
            );
        }

        return GatewayInitResult::fail(
            $body['message'] ?? 'Échec initialisation CinetPay',
            $body
        );
    }

    public function verify(string $reference, ?string $providerTransactionId = null): GatewayVerification
    {
        $res = $this->http('POST', $this->cfg['base_url'] . '/payment/check', [
            'apikey'         => $this->cfg['api_key'],
            'site_id'        => $this->cfg['site_id'],
            'transaction_id' => $reference,
        ]);
        $body = $res['body'];

        $status = $this->mapStatus(
            (string) ($body['data']['status'] ?? ''),
            (string) ($body['code'] ?? '')
        );
        $amount = (int) round((float) ($body['data']['amount'] ?? 0));

        return new GatewayVerification(
            status: $status,
            providerTransactionId: (string) ($body['data']['payment_token'] ?? $reference),
            amount: $amount,
            currency: (string) ($body['data']['currency'] ?? 'XOF'),
            raw: $body
        );
    }

    public function verifyWebhookSignature(string $rawBody, array $headers): bool
    {
        $token = $headers['x-token'] ?? $headers['X-TOKEN'] ?? null;
        if (!is_string($token) || $token === '') {
            return false;
        }

        parse_str($rawBody, $data);

        // Concaténation ordonnée des champs signés (spec CinetPay).
        $fields = [
            'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount',
            'cpm_currency', 'signature', 'payment_method', 'cel_phone_num',
            'cpm_phone_prefixe', 'cpm_language', 'cpm_version', 'cpm_payment_config',
            'cpm_page_action', 'cpm_custom', 'cpm_designation', 'cpm_error_message',
        ];
        $concat = '';
        foreach ($fields as $f) {
            $concat .= (string) ($data[$f] ?? '');
        }

        $expected = hash_hmac('sha256', $concat, (string) $this->cfg['secret_key']);
        return hash_equals($expected, $token);
    }

    public function parseWebhook(array $payload): WebhookEvent
    {
        return new WebhookEvent(
            reference: (string) ($payload['cpm_trans_id'] ?? ''),
            providerTransactionId: $payload['cpm_payid'] ?? null,
            announcedStatus: null, // CinetPay impose une re-vérification via /check
            raw: $payload
        );
    }

    private function mapStatus(string $status, string $code): PaymentStatus
    {
        return match (strtoupper($status)) {
            'ACCEPTED', 'SUCCES', 'SUCCESS' => PaymentStatus::SUCCESS,
            'REFUSED'                        => PaymentStatus::FAILED,
            'CANCELED', 'CANCELLED'          => PaymentStatus::CANCELLED,
            'EXPIRED'                        => PaymentStatus::EXPIRED,
            default => $code === '00' ? PaymentStatus::SUCCESS : PaymentStatus::PENDING,
        };
    }
}

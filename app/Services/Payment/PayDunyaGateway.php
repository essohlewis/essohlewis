<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use Transouscris\Core\Config;

/**
 * Intégration PayDunya (Checkout Invoice + Disbursement).
 *
 *  - initialize : POST /checkout-invoice/create → response_text (URL) + token
 *  - verify     : GET  /checkout-invoice/confirm/{token} → statut réel
 *  - webhook    : PayDunya renvoie l'objet invoice ; on confirme toujours via
 *                 l'API (le hash renvoyé peut aussi être recoupé au master_key).
 *
 * Les en-têtes d'authentification portent les clés du compte marchand.
 */
final class PayDunyaGateway extends AbstractGateway
{
    private array $cfg;

    public function __construct(?array $config = null)
    {
        $this->cfg = $config ?? Config::get('payments.paydunya');
    }

    public function name(): string
    {
        return 'paydunya';
    }

    private function authHeaders(): array
    {
        return [
            'PAYDUNYA-MASTER-KEY: '  . $this->cfg['master_key'],
            'PAYDUNYA-PRIVATE-KEY: ' . $this->cfg['private_key'],
            'PAYDUNYA-TOKEN: '       . $this->cfg['token'],
        ];
    }

    public function initialize(PaymentContext $ctx): GatewayInitResult
    {
        $payload = [
            'invoice' => [
                'total_amount' => $ctx->amount,
                'description'  => $ctx->description,
            ],
            'store' => [
                'name' => Config::get('app.name', 'Transouscris'),
            ],
            'actions' => [
                'return_url' => $ctx->returnUrl,
                'callback_url' => $ctx->notifyUrl,
            ],
            'custom_data' => [
                'reference' => $ctx->reference,
            ] + $ctx->metadata,
        ];

        $res = $this->http(
            'POST',
            $this->cfg['base_url'] . '/checkout-invoice/create',
            $payload,
            $this->authHeaders()
        );
        $body = $res['body'];

        if ((int) ($body['response_code'] ?? 0) === 0 || ($body['response_code'] ?? '') === '00') {
            return GatewayInitResult::ok(
                redirectUrl: $body['response_text'] ?? null,
                token: $body['token'] ?? null,
                providerTxnId: $body['token'] ?? null,
                raw: $body
            );
        }

        return GatewayInitResult::fail(
            $body['response_text'] ?? 'Échec initialisation PayDunya',
            $body
        );
    }

    public function verify(string $reference, ?string $providerTransactionId = null): GatewayVerification
    {
        // PayDunya confirme par le token de la facture (providerTransactionId).
        $token = $providerTransactionId ?: $reference;
        $res = $this->http(
            'GET',
            $this->cfg['base_url'] . '/checkout-invoice/confirm/' . rawurlencode($token),
            [],
            $this->authHeaders()
        );
        $body = $res['body'];

        $status = $this->mapStatus((string) ($body['status'] ?? ''));
        $amount = (int) round((float) ($body['invoice']['total_amount'] ?? 0));

        return new GatewayVerification(
            status: $status,
            providerTransactionId: $token,
            amount: $amount,
            currency: 'XOF',
            raw: $body
        );
    }

    public function verifyWebhookSignature(string $rawBody, array $headers): bool
    {
        // PayDunya inclut un champ `hash` = SHA512(master_key). On le recoupe,
        // puis la re-vérification API reste obligatoire côté PaymentController.
        parse_str($rawBody, $data);
        $hash = $data['data']['hash'] ?? ($data['hash'] ?? null);
        if (!is_string($hash) || $hash === '') {
            return false;
        }
        $expected = hash('sha512', (string) $this->cfg['master_key']);
        return hash_equals($expected, $hash);
    }

    public function parseWebhook(array $payload): WebhookEvent
    {
        $data = $payload['data'] ?? $payload;
        $reference = $data['custom_data']['reference']
            ?? $data['invoice']['custom_data']['reference']
            ?? '';

        return new WebhookEvent(
            reference: (string) $reference,
            providerTransactionId: $data['invoice']['token'] ?? ($data['token'] ?? null),
            announcedStatus: null,
            raw: $payload
        );
    }

    private function mapStatus(string $status): PaymentStatus
    {
        return match (strtolower($status)) {
            'completed' => PaymentStatus::SUCCESS,
            'cancelled', 'canceled' => PaymentStatus::CANCELLED,
            'failed'    => PaymentStatus::FAILED,
            'expired'   => PaymentStatus::EXPIRED,
            default     => PaymentStatus::PENDING,
        };
    }
}

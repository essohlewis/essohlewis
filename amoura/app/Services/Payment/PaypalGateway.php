<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;

/**
 * PayPal (Orders API v2). OAuth2 client-credentials + capture serveur.
 */
final class PaypalGateway implements PaymentGateway
{
    private const BASE = 'https://api-m.paypal.com'; // sandbox : api-m.sandbox.paypal.com

    public function __construct(private Setting $settings = new Setting()) {}

    private function accessToken(): ?string
    {
        $id = (string) $this->settings->get('paypal_client_id', '');
        $secret = (string) $this->settings->get('paypal_secret', '');
        if ($id === '' || $secret === '') {
            return null;
        }
        $ch = curl_init(self::BASE . '/v1/oauth2/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_USERPWD => $id . ':' . $secret,
            CURLOPT_TIMEOUT => 20,
        ]);
        $body = json_decode((string) curl_exec($ch), true) ?: [];
        curl_close($ch);
        return $body['access_token'] ?? null;
    }

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $token = $this->accessToken();
        if (!$token) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'PayPal non configuré.'];
        }
        $res = Http::post(self::BASE . '/v2/checkout/orders', [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $transaction['id'],
                'amount' => [
                    'currency_code' => $transaction['currency'] ?? 'USD',
                    'value' => number_format($transaction['amount_cents'] / 100, 2, '.', ''),
                ],
            ]],
            'application_context' => ['return_url' => $returnUrl, 'cancel_url' => $returnUrl],
        ], ['Authorization: Bearer ' . $token]);

        $id = $res['body']['id'] ?? null;
        $approve = null;
        foreach ($res['body']['links'] ?? [] as $link) {
            if (($link['rel'] ?? '') === 'approve') {
                $approve = $link['href'];
            }
        }
        if (!$id || !$approve) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Échec PayPal.'];
        }
        return ['ok' => true, 'redirect_url' => $approve, 'client' => null, 'reference' => $id, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $token = $this->accessToken();
        if (!$token) {
            return ['ok' => false, 'paid' => false, 'reference' => $reference, 'error' => 'PayPal non configuré.'];
        }
        // Capture l'ordre (idempotent côté PayPal via l'id).
        $res = Http::post(self::BASE . '/v2/checkout/orders/' . urlencode($reference) . '/capture', [],
            ['Authorization: Bearer ' . $token]);
        $paid = ($res['body']['status'] ?? '') === 'COMPLETED';
        return ['ok' => $res['status'] < 300, 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : 'Paiement non confirmé.'];
    }

    /**
     * Vérifie l'authenticité d'un webhook PayPal via l'API officielle
     * /v1/notifications/verify-webhook-signature (échec fermé : false par défaut).
     */
    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        $webhookId = (string) $this->settings->get('paypal_webhook_id', '');
        if ($webhookId === '') {
            return false; // non configuré → on refuse plutôt que d'accepter aveuglément
        }

        $h = self::normalizeHeaders($headers);
        $required = [
            'paypal-transmission-id', 'paypal-transmission-time',
            'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo',
        ];
        foreach ($required as $key) {
            if (empty($h[$key])) {
                return false;
            }
        }

        $event = json_decode($payload, true);
        if (!is_array($event)) {
            return false;
        }

        $token = $this->accessToken();
        if (!$token) {
            return false;
        }

        $res = Http::post(self::BASE . '/v1/notifications/verify-webhook-signature', [
            'transmission_id'   => $h['paypal-transmission-id'],
            'transmission_time' => $h['paypal-transmission-time'],
            'transmission_sig'  => $h['paypal-transmission-sig'],
            'cert_url'          => $h['paypal-cert-url'],
            'auth_algo'         => $h['paypal-auth-algo'],
            'webhook_id'        => $webhookId,
            'webhook_event'     => $event,
        ], ['Authorization: Bearer ' . $token]);

        return ($res['body']['verification_status'] ?? '') === 'SUCCESS';
    }

    /** Normalise les noms d'en-têtes en minuscules (getallheaders varie selon le serveur). */
    public static function normalizeHeaders(array $headers): array
    {
        $out = [];
        foreach ($headers as $name => $value) {
            $out[strtolower((string) $name)] = $value;
        }
        return $out;
    }
}

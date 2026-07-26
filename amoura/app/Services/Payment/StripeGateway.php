<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Core\Env;
use Amoura\Models\Setting;

/**
 * Stripe Checkout — cartes internationales.
 * Utilise l'API REST directement (form-urlencoded) — aucune dépendance SDK.
 */
final class StripeGateway implements PaymentGateway
{
    private const BASE = 'https://api.stripe.com/v1';

    public function __construct(private Setting $settings = new Setting()) {}

    private function secretKey(): string
    {
        return (string) ($this->settings->get('stripe_secret_key') ?: Env::get('STRIPE_SECRET_KEY', ''));
    }

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $key = $this->secretKey();
        if ($key === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Stripe non configuré.'];
        }

        // Création d'une session Checkout via l'API form-encodée.
        $fields = http_build_query([
            'mode' => 'payment',
            'success_url' => $returnUrl . '?status=success',
            'cancel_url'  => $returnUrl . '?status=cancel',
            'client_reference_id' => (string) $transaction['id'],
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => strtolower($transaction['currency'] ?? 'usd'),
                    'unit_amount' => (int) $transaction['amount_cents'],
                    'product_data' => ['name' => 'Abonnement ' . ($plan['name'] ?? '')],
                ],
            ]],
        ]);

        $ch = curl_init(self::BASE . '/checkout/sessions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $fields,
            CURLOPT_USERPWD => $key . ':',
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $body = json_decode((string) $raw, true) ?: [];

        if (empty($body['url'])) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => $body['error']['message'] ?? 'Échec Stripe.'];
        }
        return ['ok' => true, 'redirect_url' => $body['url'], 'client' => null,
                'reference' => $body['id'], 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $key = $this->secretKey();
        $ch = curl_init(self::BASE . '/checkout/sessions/' . urlencode($reference));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $key . ':', CURLOPT_TIMEOUT => 20]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $body = json_decode((string) $raw, true) ?: [];
        $paid = ($body['payment_status'] ?? '') === 'paid';
        return ['ok' => !empty($body['id']), 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : 'Paiement non confirmé.'];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        $secret = (string) ($this->settings->get('stripe_webhook_secret') ?: Env::get('STRIPE_WEBHOOK_SECRET', ''));
        $sigHeader = $headers['Stripe-Signature'] ?? $headers['stripe-signature'] ?? '';
        if ($secret === '' || $sigHeader === '') {
            return false;
        }
        // Vérification HMAC-SHA256 conforme au schéma « t=...,v1=... » de Stripe.
        $parts = [];
        foreach (explode(',', $sigHeader) as $pair) {
            [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
            $parts[$k] = $v;
        }
        $timestamp = $parts['t'] ?? '';
        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
        return isset($parts['v1']) && hash_equals($expected, $parts['v1']);
    }
}

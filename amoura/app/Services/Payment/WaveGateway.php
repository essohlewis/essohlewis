<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;

/**
 * Wave — mobile money direct (Sénégal, Côte d'Ivoire). Devise XOF.
 * API Checkout : https://docs.wave.com
 *
 * Sécurité : le webhook est signé (en-tête « Wave-Signature: t=…, v1=HMAC »).
 * On vérifie la signature HMAC-SHA256 PUIS on re-vérifie le statut réel via
 * l'API (verify()) avant toute activation.
 */
final class WaveGateway implements PaymentGateway
{
    private const BASE = 'https://api.wave.com/v1';

    public function __construct(private Setting $settings = new Setting()) {}

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $apiKey = (string) $this->settings->get('wave_api_key', '');
        if ($apiKey === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Passerelle Wave non configurée (renseignez la clé API dans l\'admin).'];
        }

        // Wave attend un montant entier en XOF (sans centimes), en chaîne.
        $amount = (string) (int) round((int) $transaction['amount_cents'] / 100);
        $clientRef = 'AMO-' . ($transaction['id'] ?? '0') . '-' . bin2hex(random_bytes(4));

        $payload = [
            'amount'           => $amount,
            'currency'         => 'XOF',
            'success_url'      => $returnUrl,
            'error_url'        => $returnUrl,
            'client_reference' => $clientRef,
        ];

        $res = Http::post(self::BASE . '/checkout/sessions', $payload, ['Authorization: Bearer ' . $apiKey]);
        $sessionId = $res['body']['id'] ?? null;
        $url = $res['body']['wave_launch_url'] ?? null;

        if (!$sessionId || !$url) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => $sessionId,
                    'error' => $res['body']['message'] ?? $res['body']['error_message'] ?? 'Échec de l\'initialisation Wave.'];
        }
        // La référence conservée est l'identifiant de session Wave (sert au verify).
        return ['ok' => true, 'redirect_url' => $url, 'client' => null, 'reference' => $sessionId, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $apiKey = (string) $this->settings->get('wave_api_key', '');

        $res = Http::get(self::BASE . '/checkout/sessions/' . rawurlencode($reference),
            ['Authorization: Bearer ' . $apiKey]);

        $body = $res['body'];
        // Paiement confirmé : session complétée ET paiement réussi.
        $paid = ($body['checkout_status'] ?? null) === 'complete'
             && ($body['payment_status'] ?? null) === 'succeeded';

        // Contrôle anti-falsification du montant (XOF entier).
        $expected = (int) round((int) $transaction['amount_cents'] / 100);
        if ($paid && isset($body['amount']) && (int) $body['amount'] < $expected) {
            $paid = false;
        }

        return ['ok' => $res['status'] === 200, 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : ($body['message'] ?? 'Paiement non confirmé.')];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        $secret = (string) $this->settings->get('wave_webhook_secret', '');
        if ($secret === '') {
            return false; // fail-closed : rien n'est cru sans secret configuré
        }

        // En-tête « Wave-Signature: t=<timestamp>, v1=<hmac> » (casse variable).
        $header = '';
        foreach ($headers as $name => $value) {
            if (strcasecmp((string) $name, 'wave-signature') === 0) {
                $header = is_array($value) ? (string) ($value[0] ?? '') : (string) $value;
                break;
            }
        }
        if ($header === '') {
            return false;
        }

        $timestamp = '';
        $signature = '';
        foreach (explode(',', $header) as $part) {
            [$k, $v] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($k === 't') {
                $timestamp = $v;
            } elseif ($k === 'v1') {
                $signature = $v;
            }
        }
        if ($timestamp === '' || $signature === '') {
            return false;
        }

        // Charge signée = timestamp concaténé au corps brut.
        $expected = hash_hmac('sha256', $timestamp . $payload, $secret);
        return hash_equals($expected, $signature);
    }
}

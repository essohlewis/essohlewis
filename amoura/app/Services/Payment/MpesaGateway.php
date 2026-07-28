<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;
use Amoura\Services\Money\CurrencyContext;
use Amoura\Services\Money\CurrencyConverter;

/**
 * M-Pesa (Safaricom Daraja) — STK Push « Lipa Na M-Pesa Online » (Kenya, KES).
 * Doc : https://developer.safaricom.co.ke
 *
 * Le paiement est poussé sur le téléphone du client (pas de redirection).
 * Le callback M-Pesa n'est pas signé : on re-vérifie systématiquement le statut
 * réel via l'API (verify()) avant toute activation.
 */
final class MpesaGateway implements PaymentGateway
{
    public function __construct(private Setting $settings = new Setting()) {}

    private function base(): string
    {
        return strtolower((string) $this->settings->get('mpesa_env', 'sandbox')) === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    /** Horodatage Daraja (AAAAMMJJHHmmss). */
    public static function timestamp(?int $now = null): string
    {
        return date('YmdHis', $now ?? time());
    }

    /** Mot de passe Daraja : base64(shortcode + passkey + timestamp). */
    public static function password(string $shortcode, string $passkey, string $timestamp): string
    {
        return base64_encode($shortcode . $passkey . $timestamp);
    }

    /** Numéro au format M-Pesa (2547XXXXXXXX / 2557XXXXXXXX). */
    public static function normalizePhone(string $phone): string
    {
        return preg_replace('/\D/', '', $phone) ?? '';
    }

    /** Jeton OAuth (client_credentials). */
    private function token(): ?string
    {
        $key = (string) $this->settings->get('mpesa_consumer_key', '');
        $secret = (string) $this->settings->get('mpesa_consumer_secret', '');
        if ($key === '' || $secret === '') {
            return null;
        }
        $res = Http::get($this->base() . '/oauth/v1/generate?grant_type=client_credentials',
            ['Authorization: Basic ' . base64_encode($key . ':' . $secret)]);
        $token = $res['body']['access_token'] ?? null;
        return is_string($token) ? $token : null;
    }

    /** Convertit un montant XOF (centimes) en entier KES pour M-Pesa. */
    private static function amountKes(int $amountCents): int
    {
        $xof = $amountCents / 100;
        $rates = CurrencyContext::rates();
        $kes = CurrencyConverter::convert($xof, 'XOF', 'KES', $rates);
        return max(1, (int) round($kes));
    }

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $shortcode = (string) $this->settings->get('mpesa_shortcode', '');
        $passkey = (string) $this->settings->get('mpesa_passkey', '');
        $phone = self::normalizePhone((string) ($transaction['phone'] ?? ''));

        if ($shortcode === '' || $passkey === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Passerelle M-Pesa non configurée (renseignez les identifiants dans l\'admin).'];
        }
        if ($phone === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Numéro de téléphone requis pour M-Pesa.'];
        }
        $token = $this->token();
        if ($token === null) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Authentification M-Pesa impossible (vérifiez les clés).'];
        }

        $ts = self::timestamp();
        $payload = [
            'BusinessShortCode' => $shortcode,
            'Password'          => self::password($shortcode, $passkey, $ts),
            'Timestamp'         => $ts,
            'TransactionType'   => 'CustomerPayBillOnline',
            'Amount'            => self::amountKes((int) $transaction['amount_cents']),
            'PartyA'            => $phone,
            'PartyB'            => $shortcode,
            'PhoneNumber'       => $phone,
            'CallBackURL'       => $webhookUrl,
            'AccountReference'  => 'AMO-' . ($transaction['id'] ?? '0'),
            'TransactionDesc'   => 'Abonnement ' . ($plan['name'] ?? 'Amoura'),
        ];

        $res = Http::post($this->base() . '/mpesa/stkpush/v1/processrequest', $payload,
            ['Authorization: Bearer ' . $token]);
        $checkoutId = $res['body']['CheckoutRequestID'] ?? null;

        if (($res['body']['ResponseCode'] ?? null) !== '0' || !$checkoutId) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => $checkoutId,
                    'error' => $res['body']['errorMessage'] ?? $res['body']['ResponseDescription'] ?? 'Échec de l\'initialisation M-Pesa.'];
        }

        // Pas de redirection : le client valide sur son téléphone → page d'attente.
        return ['ok' => true, 'redirect_url' => null,
                'client' => ['message' => 'Validez le paiement sur votre téléphone (M-Pesa).'],
                'reference' => (string) $checkoutId, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $shortcode = (string) $this->settings->get('mpesa_shortcode', '');
        $passkey = (string) $this->settings->get('mpesa_passkey', '');
        $token = $this->token();
        if ($token === null) {
            return ['ok' => false, 'paid' => false, 'reference' => $reference, 'error' => 'Authentification M-Pesa impossible.'];
        }

        $ts = self::timestamp();
        $res = Http::post($this->base() . '/mpesa/stkpushquery/v1/query', [
            'BusinessShortCode' => $shortcode,
            'Password'          => self::password($shortcode, $passkey, $ts),
            'Timestamp'         => $ts,
            'CheckoutRequestID' => $reference,
        ], ['Authorization: Bearer ' . $token]);

        // ResultCode "0" = paiement confirmé.
        $paid = (string) ($res['body']['ResultCode'] ?? '') === '0';
        return ['ok' => $res['status'] === 200, 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : ($res['body']['ResultDesc'] ?? 'Paiement non confirmé.')];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // Daraja ne signe pas le callback : on ne fait pas confiance au corps ;
        // le contrôleur webhook re-vérifie le statut réel via verify().
        return true;
    }
}

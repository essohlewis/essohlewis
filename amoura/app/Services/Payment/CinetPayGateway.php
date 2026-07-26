<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;

/**
 * CinetPay — Mobile Money Afrique de l'Ouest (Orange, MTN, Moov) + cartes.
 * Détection d'opérateur par préfixe : 07 → Orange, 05 → MTN, 01 → Moov (CI).
 * Documentation API : https://docs.cinetpay.com
 */
final class CinetPayGateway implements PaymentGateway
{
    private const BASE = 'https://api-checkout.cinetpay.com/v2';

    public function __construct(private Setting $settings = new Setting()) {}

    public static function operatorFromPhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        // On regarde le préfixe local (2 premiers chiffres après l'indicatif éventuel).
        $local = preg_replace('/^225/', '', $digits);
        $prefix = substr($local, 0, 2);
        return match ($prefix) {
            '07' => 'orange_money',
            '05' => 'mtn_money',
            '01' => 'moov_money',
            default => 'mobile_money',
        };
    }

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $apiKey = (string) $this->settings->get('cinetpay_api_key', '');
        $siteId = (string) $this->settings->get('cinetpay_site_id', '');
        if ($apiKey === '' || $siteId === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Passerelle CinetPay non configurée (renseignez les clés dans l\'admin).'];
        }

        // CinetPay attend un montant entier dans la devise (XOF sans centimes).
        $amount = (int) round($transaction['amount_cents'] / 100);
        $reference = 'AMO-' . $transaction['id'] . '-' . bin2hex(random_bytes(4));

        $payload = [
            'apikey'          => $apiKey,
            'site_id'         => $siteId,
            'transaction_id'  => $reference,
            'amount'          => $amount,
            'currency'        => $transaction['currency'] ?? 'XOF',
            'description'     => 'Abonnement ' . ($plan['name'] ?? ''),
            'channels'        => 'ALL', // cartes + mobile money
            'return_url'      => $returnUrl,
            'notify_url'      => $webhookUrl,
            'customer_phone_number' => $transaction['phone'] ?? null,
        ];

        $res = Http::post(self::BASE . '/payment', $payload);
        $token = $res['body']['data']['payment_token'] ?? null;
        $url   = $res['body']['data']['payment_url'] ?? null;

        if (!$url) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => $reference,
                    'error' => $res['body']['message'] ?? 'Échec de l\'initialisation CinetPay.'];
        }
        return ['ok' => true, 'redirect_url' => $url, 'client' => ['token' => $token],
                'reference' => $reference, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $apiKey = (string) $this->settings->get('cinetpay_api_key', '');
        $siteId = (string) $this->settings->get('cinetpay_site_id', '');

        $res = Http::post(self::BASE . '/payment/check', [
            'apikey' => $apiKey,
            'site_id' => $siteId,
            'transaction_id' => $reference,
        ]);

        $status = $res['body']['data']['status'] ?? null;
        // « ACCEPTED » = paiement confirmé côté CinetPay.
        $paid = $status === 'ACCEPTED';
        return ['ok' => $res['status'] === 200, 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : ($res['body']['message'] ?? 'Paiement non confirmé.')];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // CinetPay ne signe pas HMAC par défaut : on ré-interroge l'API dans le
        // contrôleur webhook (verify()) plutôt que de faire confiance au corps reçu.
        return true;
    }
}

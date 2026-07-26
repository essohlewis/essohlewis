<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;

/**
 * PayDunya — Mobile Money & cartes Afrique de l'Ouest (alternative à CinetPay).
 * Documentation : https://paydunya.com/developers
 */
final class PayDunyaGateway implements PaymentGateway
{
    private const BASE = 'https://app.paydunya.com/api/v1';

    public function __construct(private Setting $settings = new Setting()) {}

    private function headers(): array
    {
        return [
            'PAYDUNYA-MASTER-KEY: ' . (string) $this->settings->get('paydunya_master_key', ''),
            'PAYDUNYA-PRIVATE-KEY: ' . (string) $this->settings->get('paydunya_private_key', ''),
            'PAYDUNYA-TOKEN: ' . (string) $this->settings->get('paydunya_token', ''),
        ];
    }

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        if ((string) $this->settings->get('paydunya_master_key', '') === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'PayDunya non configuré.'];
        }
        $payload = [
            'invoice' => [
                'total_amount' => (int) round($transaction['amount_cents'] / 100),
                'description' => 'Abonnement ' . ($plan['name'] ?? ''),
            ],
            'store' => ['name' => 'Amoura'],
            'actions' => ['return_url' => $returnUrl, 'callback_url' => $webhookUrl],
            'custom_data' => ['transaction_id' => $transaction['id']],
        ];
        $res = Http::post(self::BASE . '/checkout-invoice/create', $payload, $this->headers());
        $token = $res['body']['token'] ?? null;
        $url = $res['body']['response_text'] ?? null;
        if (!$token) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => $res['body']['response_text'] ?? 'Échec PayDunya.'];
        }
        return ['ok' => true, 'redirect_url' => $url, 'client' => ['token' => $token],
                'reference' => $token, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $res = Http::get(self::BASE . '/checkout-invoice/confirm/' . urlencode($reference), $this->headers());
        $status = $res['body']['status'] ?? '';
        $paid = $status === 'completed';
        return ['ok' => $res['status'] === 200, 'paid' => $paid, 'reference' => $reference,
                'error' => $paid ? null : 'Paiement non confirmé.'];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // PayDunya renvoie les données du paiement ; on reconfirme via verify().
        return true;
    }
}

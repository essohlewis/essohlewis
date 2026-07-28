<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

use Amoura\Models\Setting;
use Amoura\Models\User;

/**
 * Flutterwave — paiements panafricains (cartes, mobile money, virement) et
 * multi-devises (XOF, NGN, GHS, USD, EUR…).
 * Documentation : https://developer.flutterwave.com
 *
 * Sécurité : le webhook n'est jamais cru sur parole — signature « verif-hash »
 * vérifiée PUIS re-vérification du statut réel via l'API (verify()).
 */
final class FlutterwaveGateway implements PaymentGateway
{
    private const BASE = 'https://api.flutterwave.com/v3';

    public function __construct(private Setting $settings = new Setting()) {}

    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array
    {
        $secret = (string) $this->settings->get('flutterwave_secret_key', '');
        if ($secret === '') {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => null,
                    'error' => 'Passerelle Flutterwave non configurée (renseignez la clé secrète dans l\'admin).'];
        }

        $reference = 'AMO-' . $transaction['id'] . '-' . bin2hex(random_bytes(4));
        $user = (new User())->find((int) ($transaction['user_id'] ?? 0));

        $payload = [
            'tx_ref'       => $reference,
            'amount'       => round((int) $transaction['amount_cents'] / 100, 2),
            'currency'     => $transaction['currency'] ?? 'XOF',
            'redirect_url' => $returnUrl,
            'customer'     => [
                'email'       => $user['email'] ?? ('user' . ($transaction['user_id'] ?? '0') . '@amoura.local'),
                'phonenumber' => $transaction['phone'] ?? null,
                'name'        => $user['display_name'] ?? 'Membre Amoura',
            ],
            'meta'           => ['transaction_id' => $transaction['id'] ?? null],
            'customizations' => ['title' => 'Amoura', 'description' => 'Abonnement ' . ($plan['name'] ?? '')],
        ];

        $res = Http::post(self::BASE . '/payments', $payload, ['Authorization: Bearer ' . $secret]);
        $url = $res['body']['data']['link'] ?? null;

        if (($res['body']['status'] ?? '') !== 'success' || !$url) {
            return ['ok' => false, 'redirect_url' => null, 'client' => null, 'reference' => $reference,
                    'error' => $res['body']['message'] ?? 'Échec de l\'initialisation Flutterwave.'];
        }
        return ['ok' => true, 'redirect_url' => $url, 'client' => null, 'reference' => $reference, 'error' => null];
    }

    public function verify(string $reference, array $transaction): array
    {
        $secret = (string) $this->settings->get('flutterwave_secret_key', '');

        // Vérification par référence locale (notre tx_ref).
        $res = Http::get(
            self::BASE . '/transactions/verify_by_reference?tx_ref=' . rawurlencode($reference),
            ['Authorization: Bearer ' . $secret]
        );

        $data = $res['body']['data'] ?? [];
        $status = $data['status'] ?? null;

        // Contrôle anti-falsification : statut ET montant ET devise doivent coller.
        $expectedAmount = round((int) $transaction['amount_cents'] / 100, 2);
        $amountOk = isset($data['amount']) && (float) $data['amount'] >= $expectedAmount - 0.01;
        $currencyOk = !isset($transaction['currency']) || ($data['currency'] ?? null) === $transaction['currency'];
        $paid = $status === 'successful' && $amountOk && $currencyOk;

        return [
            'ok' => $res['status'] === 200,
            'paid' => $paid,
            'reference' => $data['id'] ?? $reference,   // id transaction prestataire
            'error' => $paid ? null : ($res['body']['message'] ?? 'Paiement non confirmé.'),
        ];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        $expected = (string) $this->settings->get('flutterwave_secret_hash', '');
        if ($expected === '') {
            // Pas de hash configuré : on ne fait pas confiance au corps ; le
            // contrôleur re-vérifie via verify(). On refuse par prudence.
            return false;
        }
        // Flutterwave envoie l'en-tête « verif-hash » (casse variable selon le serveur).
        $received = '';
        foreach ($headers as $name => $value) {
            if (strcasecmp((string) $name, 'verif-hash') === 0) {
                $received = is_array($value) ? (string) ($value[0] ?? '') : (string) $value;
                break;
            }
        }
        return $received !== '' && hash_equals($expected, $received);
    }
}

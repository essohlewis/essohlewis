<?php

declare(strict_types=1);

namespace App\Services;

use App\Helpers\Logger;

/**
 * Intégration PayDunya (Wave, Orange Money, MTN, Moov).
 *
 * SÉCURITÉ : `confirm()` re-vérifie la transaction via l'API PayDunya avec
 * le token de facture. On ne crédite que si status = completed ET montant OK.
 */
final class PayDunyaService
{
    /** @var array<string,mixed> */
    private array $config;
    private string $baseUrl;

    public function __construct()
    {
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $this->config = $config['paydunya'];
        $this->baseUrl = $this->config['mode'] === 'live'
            ? 'https://app.paydunya.com/api/v1'
            : 'https://app.paydunya.com/sandbox-api/v1';
    }

    /**
     * Crée une facture. Renvoie l'URL de paiement + le token de facture.
     * @return array{payment_url:string,provider_tx_id:string}
     */
    public function initiate(string $reference, int $amountFcfa, string $description, string $returnUrl, string $callbackUrl): array
    {
        $payload = [
            'invoice' => [
                'total_amount' => $amountFcfa,
                'description'  => $description,
            ],
            'store' => ['name' => 'CONTEO'],
            'custom_data' => ['reference' => $reference],
            'actions' => [
                'callback_url' => $callbackUrl,
                'return_url'   => $returnUrl,
            ],
        ];

        $resp = $this->post($this->baseUrl . '/checkout-invoice/create', $payload);

        if ((int) ($resp['response_code'] ?? 0) === 0 || ($resp['response_code'] ?? null) === '00') {
            return [
                'payment_url'    => (string) ($resp['response_text'] ?? ''),
                'provider_tx_id' => (string) ($resp['token'] ?? ''),
            ];
        }

        Logger::error('PayDunya initiate failed', ['ref' => $reference, 'resp' => $resp]);
        throw new \RuntimeException('Échec de l\'initialisation du paiement.');
    }

    /**
     * RE-VÉRIFICATION serveur-à-serveur obligatoire, via le token de facture.
     * @return array{status:string,amount:int,provider_tx_id:?string,raw:array}
     */
    public function confirm(string $invoiceToken): array
    {
        $resp = $this->get($this->baseUrl . '/checkout-invoice/confirm/' . rawurlencode($invoiceToken));

        $status = strtolower((string) ($resp['status'] ?? 'unknown'));
        $mapped = match ($status) {
            'completed' => 'success',
            'cancelled' => 'cancelled',
            'failed'    => 'failed',
            default     => 'pending',
        };

        $amount = (int) ($resp['invoice']['total_amount'] ?? 0);

        return [
            'status'         => $mapped,
            'amount'         => $amount,
            'provider_tx_id' => $invoiceToken,
            'raw'            => $resp,
        ];
    }

    public function isWhitelistedIp(string $ip): bool
    {
        $ips = $this->config['webhook_ips'];
        if (!$ips) {
            return false;
        }
        return in_array($ip, $ips, true);
    }

    /** @return array<string,mixed> */
    private function headers(): array
    {
        return [
            'Content-Type: application/json',
            'PAYDUNYA-MASTER-KEY: ' . $this->config['master_key'],
            'PAYDUNYA-PRIVATE-KEY: ' . $this->config['private_key'],
            'PAYDUNYA-TOKEN: ' . $this->config['token'],
        ];
    }

    /** @return array<string,mixed> */
    private function post(string $url, array $payload): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => $this->headers(),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        $decoded = json_decode((string) $body, true);
        return is_array($decoded) ? $decoded : [];
    }

    /** @return array<string,mixed> */
    private function get(string $url): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $this->headers(),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        $decoded = json_decode((string) $body, true);
        return is_array($decoded) ? $decoded : [];
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Helpers\Logger;

/**
 * Intégration CinetPay (Wave, Orange Money, MTN MoMo, Moov Money).
 *
 * SÉCURITÉ : aucune action financière ne doit résulter d'un simple callback.
 * `checkPayStatus()` re-vérifie systématiquement la transaction en appelant
 * l'API CinetPay avec la référence. On ne crédite que si status = ACCEPTED
 * ET que le montant correspond.
 */
final class CinetPayService
{
    /** @var array<string,mixed> */
    private array $config;

    public function __construct()
    {
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $this->config = $config['cinetpay'];
    }

    /**
     * Initialise un paiement. Renvoie l'URL de paiement à ouvrir côté client.
     * @return array{payment_url:string,provider_tx_id:?string}
     */
    public function initiate(string $reference, int $amountFcfa, string $description, string $channel, string $returnUrl, string $notifyUrl): array
    {
        $payload = [
            'apikey'         => $this->config['api_key'],
            'site_id'        => $this->config['site_id'],
            'transaction_id' => $reference,
            'amount'         => $amountFcfa,
            'currency'       => 'XOF',
            'description'    => $description,
            'notify_url'     => $notifyUrl,
            'return_url'     => $returnUrl,
            'channels'       => $this->mapChannel($channel),
            'lang'           => 'fr',
        ];

        $resp = $this->post($this->config['base_url'] . '/payment', $payload);

        if (($resp['code'] ?? null) === '201' && isset($resp['data']['payment_url'])) {
            return [
                'payment_url'    => (string) $resp['data']['payment_url'],
                'provider_tx_id' => $resp['data']['payment_token'] ?? null,
            ];
        }

        Logger::error('CinetPay initiate failed', ['ref' => $reference, 'resp' => $resp]);
        throw new \RuntimeException('Échec de l\'initialisation du paiement.');
    }

    /**
     * RE-VÉRIFICATION serveur-à-serveur obligatoire.
     * @return array{status:string,amount:int,provider_tx_id:?string,raw:array}
     */
    public function checkPayStatus(string $reference): array
    {
        $payload = [
            'apikey'         => $this->config['api_key'],
            'site_id'        => $this->config['site_id'],
            'transaction_id' => $reference,
        ];
        $resp = $this->post($this->config['base_url'] . '/payment/check', $payload);

        $data = $resp['data'] ?? [];
        // CinetPay : status ACCEPTED = succès.
        $status = strtoupper((string) ($data['status'] ?? 'UNKNOWN'));
        $mapped = match ($status) {
            'ACCEPTED'          => 'success',
            'REFUSED'           => 'failed',
            'CANCELED'          => 'cancelled',
            default             => 'pending',
        };

        return [
            'status'         => $mapped,
            'amount'         => (int) ($data['amount'] ?? 0),
            'provider_tx_id' => $data['payment_token'] ?? ($data['operator_id'] ?? null),
            'raw'            => $resp,
        ];
    }

    /** Vérifie que l'IP appelante est bien celle de CinetPay (si configurée). */
    public function isWhitelistedIp(string $ip): bool
    {
        $ips = $this->config['webhook_ips'];
        if (!$ips) {
            // Aucune whitelist configurée : on refuse par prudence en prod.
            return false;
        }
        return in_array($ip, $ips, true);
    }

    private function mapChannel(string $channel): string
    {
        return match ($channel) {
            'wave', 'orange_money', 'mtn_momo', 'moov_money' => 'MOBILE_MONEY',
            default => 'ALL',
        };
    }

    /** @return array<string,mixed> */
    private function post(string $url, array $payload): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 20,
        ]);
        $body = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            Logger::error('CinetPay curl error', ['err' => $err]);
            return [];
        }
        $decoded = json_decode((string) $body, true);
        return is_array($decoded) ? $decoded : [];
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use Transouscris\Core\Logger;

/**
 * Base partagée : client HTTP cURL minimal + normalisation JSON.
 */
abstract class AbstractGateway implements PaymentGatewayInterface
{
    /**
     * @param array<string,string> $headers
     * @return array{status:int, body:array, raw:string}
     */
    protected function http(string $method, string $url, array $payload = [], array $headers = []): array
    {
        $ch = curl_init($url);
        $defaultHeaders = ['Accept: application/json', 'Content-Type: application/json'];

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_HTTPHEADER     => array_merge($defaultHeaders, $headers),
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];
        if ($method !== 'GET' && $payload !== []) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $opts);

        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0) {
            Logger::error('Erreur HTTP passerelle paiement', [
                'gateway' => $this->name(),
                'url'     => $url,
                'errno'   => $errno,
                'error'   => $error,
            ]);
            return ['status' => 0, 'body' => [], 'raw' => ''];
        }

        $body = json_decode((string) $raw, true);
        return [
            'status' => $status,
            'body'   => is_array($body) ? $body : [],
            'raw'    => (string) $raw,
        ];
    }
}

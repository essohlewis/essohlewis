<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

/** Petit client HTTP JSON pour les API des prestataires (cURL). */
final class Http
{
    /** @return array{status:int, body:array} */
    public static function post(string $url, array $data, array $headers = []): array
    {
        return self::request('POST', $url, $data, $headers);
    }

    public static function get(string $url, array $headers = []): array
    {
        return self::request('GET', $url, null, $headers);
    }

    private static function request(string $method, string $url, ?array $data, array $headers): array
    {
        if (!function_exists('curl_init')) {
            return ['status' => 0, 'body' => ['error' => 'cURL indisponible']];
        }
        $ch = curl_init($url);
        $defaultHeaders = ['Accept: application/json'];
        if ($data !== null) {
            $defaultHeaders[] = 'Content-Type: application/json';
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => array_merge($defaultHeaders, $headers),
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $body = is_string($raw) ? (json_decode($raw, true) ?: []) : [];
        return ['status' => $status, 'body' => $body];
    }
}

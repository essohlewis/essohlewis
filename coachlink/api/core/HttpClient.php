<?php
/* ==========================================================================
   core/HttpClient.php — Client HTTP minimal (cURL) pour appeler les API des
   opérateurs Mobile Money. Aucune dépendance. Tolérant : renvoie toujours un
   tableau { status, json, brut, erreur } sans lever d'exception.
   ========================================================================== */

class HttpClient
{
    public static function postJson(string $url, array $data, array $headers = []): array
    {
        return self::envoyer('POST', $url, json_encode($data), array_merge(['Content-Type: application/json'], $headers));
    }

    public static function postForm(string $url, array $data, array $headers = []): array
    {
        return self::envoyer('POST', $url, http_build_query($data), array_merge(['Content-Type: application/x-www-form-urlencoded'], $headers));
    }

    public static function get(string $url, array $headers = []): array
    {
        return self::envoyer('GET', $url, null, $headers);
    }

    private static function envoyer(string $methode, string $url, ?string $corps, array $headers): array
    {
        if (!function_exists('curl_init')) {
            return ['status' => 0, 'json' => null, 'brut' => '', 'erreur' => 'cURL indisponible'];
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $methode,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);
        if ($corps !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $corps);
        }
        $brut   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $erreur = curl_error($ch) ?: null;
        curl_close($ch);

        return [
            'status' => $status,
            'json'   => is_string($brut) ? json_decode($brut, true) : null,
            'brut'   => is_string($brut) ? $brut : '',
            'erreur' => $erreur,
        ];
    }
}

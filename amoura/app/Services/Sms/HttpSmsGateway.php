<?php
declare(strict_types=1);

namespace Amoura\Services\Sms;

use Amoura\Core\Env;

/**
 * Passerelle SMS générique par API REST (Phase 1, Sprint +7).
 *
 * Compatible avec la plupart des prestataires HTTP (Orange SMS API, Twilio-like,
 * agrégateurs africains…). L'appel POST envoie un corps JSON :
 *   { "from": <SMS_FROM>, "to": <E.164>, "message": <texte> }
 * et authentifie via un jeton Bearer (SMS_HTTP_TOKEN).
 *
 * Variables .env :
 *   SMS_HTTP_URL   = https://api.prestataire.example/v1/sms
 *   SMS_HTTP_TOKEN = <clé API / bearer>
 *   SMS_FROM       = Amoura            (expéditeur / sender id)
 *   SMS_HTTP_TIMEOUT = 10              (secondes, optionnel)
 */
final class HttpSmsGateway implements SmsGateway
{
    public function __construct(
        private string $url = '',
        private string $token = '',
        private string $from = 'Amoura',
        private int $timeout = 10,
    ) {
        $this->url = $url ?: (string) Env::get('SMS_HTTP_URL', '');
        $this->token = $token ?: (string) Env::get('SMS_HTTP_TOKEN', '');
        $this->from = $from !== 'Amoura' ? $from : (string) Env::get('SMS_FROM', 'Amoura');
        $this->timeout = $timeout !== 10 ? $timeout : (int) Env::get('SMS_HTTP_TIMEOUT', 10);
    }

    public function send(string $to, string $message): array
    {
        if ($this->url === '') {
            return ['ok' => false, 'error' => 'SMS_HTTP_URL non configuré.'];
        }
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'Extension cURL requise pour la passerelle SMS HTTP.'];
        }

        $payload = json_encode([
            'from' => $this->from,
            'to' => $to,
            'message' => $message,
        ], JSON_UNESCAPED_UNICODE);

        $headers = ['Content-Type: application/json', 'Accept: application/json'];
        if ($this->token !== '') {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        $ch = curl_init($this->url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $this->timeout),
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return ['ok' => false, 'error' => 'Échec réseau SMS : ' . $curlErr];
        }
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => "Réponse prestataire {$status} : " . substr((string) $response, 0, 200)];
        }

        // Récupère un identifiant de message si le prestataire en renvoie un.
        $ref = null;
        $decoded = json_decode((string) $response, true);
        if (is_array($decoded)) {
            $ref = $decoded['id'] ?? $decoded['message_id'] ?? $decoded['sid'] ?? $decoded['ref'] ?? null;
        }
        return ['ok' => true, 'ref' => $ref !== null ? (string) $ref : ('http-' . $status)];
    }
}

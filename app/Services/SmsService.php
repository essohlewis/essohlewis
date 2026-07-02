<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Config;
use Transouscris\Core\Logger;

/**
 * Envoi de SMS via l'API SMS CinetPay (compte DISTINCT du compte marchand).
 * Utilisé pour les OTP et les notifications transactionnelles.
 *
 * En environnement local/test (app.debug), les SMS ne sont pas réellement
 * envoyés : ils sont journalisés — utile pour le développement sans crédit SMS.
 */
final class SmsService
{
    private array $cfg;

    public function __construct(?array $config = null)
    {
        $this->cfg = $config ?? Config::get('sms');
    }

    public function send(string $phone, string $message): bool
    {
        if (Config::get('app.debug')) {
            Logger::info('SMS (mode debug, non envoyé)', ['to' => $phone, 'message' => $message]);
            return true;
        }

        $ch = curl_init($this->cfg['base_url'] . '/message');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->cfg['api_key'],
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'sender'  => $this->cfg['sender'],
                'to'      => $phone,
                'content' => $message,
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status < 200 || $status >= 300) {
            Logger::error('Échec envoi SMS', ['to' => $phone, 'status' => $status, 'response' => $raw]);
            return false;
        }
        return true;
    }
}

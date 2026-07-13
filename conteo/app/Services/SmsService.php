<?php

declare(strict_types=1);

namespace App\Services;

use App\Helpers\Logger;

/**
 * Envoi d'OTP par SMS. En développement (provider = log), le code est
 * simplement journalisé. En production, brancher un agrégateur local
 * (LeTexto, Orange SMS API, etc.).
 */
final class SmsService
{
    /** @var array<string,mixed> */
    private array $config;

    public function __construct()
    {
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $this->config = $config['sms'];
    }

    public function sendOtp(string $phone, string $code): bool
    {
        $message = "CONTEO : votre code de vérification est {$code}. Il expire dans 10 minutes.";

        return match ($this->config['provider']) {
            'log'   => $this->logOnly($phone, $message),
            default => $this->logOnly($phone, $message), // TODO: brancher un agrégateur réel
        };
    }

    private function logOnly(string $phone, string $message): bool
    {
        Logger::info('SMS (dev)', ['to' => $phone, 'msg' => $message]);
        return true;
    }

    /** Génère un OTP à 6 chiffres. */
    public static function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}

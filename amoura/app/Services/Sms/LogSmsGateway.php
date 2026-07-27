<?php
declare(strict_types=1);

namespace Amoura\Services\Sms;

/**
 * Passerelle SMS de développement : journalise le message au lieu de l'envoyer.
 * Écrit dans storage/logs/sms.log — jamais utilisée en production.
 */
final class LogSmsGateway implements SmsGateway
{
    private string $logFile;

    public function __construct(?string $logFile = null)
    {
        $this->logFile = $logFile ?? (dirname(__DIR__, 3) . '/storage/logs/sms.log');
    }

    public function send(string $to, string $message): array
    {
        @mkdir(dirname($this->logFile), 0775, true);
        $line = sprintf("[%s] SMS → %s\n%s\n%s\n", date('c'), $to, str_repeat('-', 40), $message);
        @file_put_contents($this->logFile, $line, FILE_APPEND | LOCK_EX);
        return ['ok' => true, 'ref' => 'log-' . substr(md5($to . $message . microtime()), 0, 12)];
    }
}

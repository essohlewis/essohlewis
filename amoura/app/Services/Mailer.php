<?php
declare(strict_types=1);

namespace Amoura\Services;

use Amoura\Core\Env;

/**
 * Envoi d'emails. Deux pilotes :
 *  - "log"  : écrit dans storage/logs/mail.log (développement).
 *  - "smtp" : envoi via la fonction mail() de PHP (configurez un relais SMTP).
 */
final class Mailer
{
    public static function send(string $to, string $subject, string $htmlBody): bool
    {
        $driver = (string) Env::get('MAIL_DRIVER', 'log');
        $from = (string) Env::get('MAIL_FROM', 'no-reply@amoura.example');
        $fromName = (string) Env::get('MAIL_FROM_NAME', 'Amoura');

        if ($driver === 'log') {
            $line = sprintf(
                "[%s] To: %s | Subject: %s\n%s\n%s\n",
                date('c'),
                $to,
                $subject,
                str_repeat('-', 40),
                strip_tags($htmlBody)
            );
            $logDir = dirname(__DIR__, 2) . '/storage/logs';
            @mkdir($logDir, 0775, true);
            file_put_contents($logDir . '/mail.log', $line, FILE_APPEND);
            return true;
        }

        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            "From: {$fromName} <{$from}>",
        ];
        return @mail($to, $subject, $htmlBody, implode("\r\n", $headers));
    }

    public static function template(string $title, string $bodyHtml): string
    {
        $site = htmlspecialchars((string) Env::get('APP_NAME', 'Amoura'));
        return "<div style=\"font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto\">"
            . "<h2 style=\"color:#ff5a7e\">{$site}</h2>"
            . "<h3>" . htmlspecialchars($title) . "</h3>"
            . $bodyHtml
            . "<hr><p style=\"color:#888;font-size:12px\">Cet email vous a été envoyé par {$site}.</p></div>";
    }
}

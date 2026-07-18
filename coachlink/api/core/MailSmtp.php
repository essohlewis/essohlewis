<?php
/* ==========================================================================
   core/MailSmtp.php — Transport SMTP réel (sockets bruts, sans dépendance).
   Compatible avec la plupart des fournisseurs (Gmail, SendGrid, Mailgun, OVH…).
   Gère STARTTLS / SSL et l'authentification AUTH LOGIN.

   Config (config.php → mail.smtp) : host, port, chiffrement ('tls'|'ssl'|''),
   user, password. Activez avec mail.mode = 'smtp'.
   ========================================================================== */

class MailSmtp implements MailTransport
{
    public function __construct(private array $cfg) {}

    public function envoyer(array $mail): array
    {
        $host = $this->cfg['host'] ?? '';
        $port = (int) ($this->cfg['port'] ?? 587);
        $chiff = $this->cfg['chiffrement'] ?? 'tls';
        if ($host === '') {
            return ['ok' => false, 'message' => 'Hôte SMTP non configuré.'];
        }

        $prefixe = $chiff === 'ssl' ? 'ssl://' : '';
        $fp = @fsockopen($prefixe . $host, $port, $errno, $errstr, 15);
        if (!$fp) {
            return ['ok' => false, 'message' => "Connexion SMTP impossible : $errstr"];
        }
        stream_set_timeout($fp, 15);

        $lire = function () use ($fp): string {
            $data = '';
            while (($ligne = fgets($fp, 515)) !== false) {
                $data .= $ligne;
                if (isset($ligne[3]) && $ligne[3] === ' ') break;
            }
            return $data;
        };
        $ecrire = function (string $c) use ($fp): void { fwrite($fp, $c . "\r\n"); };
        $attendre = fn(string $rep, string $code): bool => str_starts_with(ltrim($rep), $code);

        $lire();
        $ecrire('EHLO coachlink.ci'); $lire();

        if ($chiff === 'tls') {
            $ecrire('STARTTLS');
            if (!$attendre($lire(), '220')) { fclose($fp); return ['ok' => false, 'message' => 'STARTTLS refusé.']; }
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                fclose($fp); return ['ok' => false, 'message' => 'Chiffrement TLS impossible.'];
            }
            $ecrire('EHLO coachlink.ci'); $lire();
        }

        if (!empty($this->cfg['user'])) {
            $ecrire('AUTH LOGIN'); $lire();
            $ecrire(base64_encode($this->cfg['user'])); $lire();
            $ecrire(base64_encode($this->cfg['password'] ?? ''));
            if (!$attendre($lire(), '235')) { fclose($fp); return ['ok' => false, 'message' => 'Authentification SMTP refusée.']; }
        }

        $from = $mail['from'] ?? 'no-reply@coachlink.ci';
        $to   = $mail['to'];
        $ecrire("MAIL FROM:<$from>"); $lire();
        $ecrire("RCPT TO:<$to>"); $lire();
        $ecrire('DATA'); $lire();

        $entetes = "From: " . ($mail['from_nom'] ?? 'CoachLink CI') . " <$from>\r\n"
            . "To: <$to>\r\n"
            . "Subject: =?UTF-8?B?" . base64_encode($mail['subject'] ?? '') . "?=\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n";
        // Un point seul sur une ligne termine les données (on échappe les points en début de ligne).
        $corps = preg_replace('/^\./m', '..', $mail['html'] ?? '');
        $ecrire($entetes . "\r\n" . $corps . "\r\n.");
        $ok = $attendre($lire(), '250');

        $ecrire('QUIT');
        fclose($fp);

        return ['ok' => $ok, 'message' => $ok ? 'Email envoyé.' : 'Envoi refusé par le serveur SMTP.'];
    }
}

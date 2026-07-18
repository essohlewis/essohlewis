<?php
/* ==========================================================================
   core/MailService.php — Sélectionne le transport d'email et fournit un envoi
   simple. Par défaut (mode 'log'), aucun email n'est réellement envoyé
   (journalisé) : l'application fonctionne sans serveur SMTP.
   ========================================================================== */

class MailService
{
    public static function transport(): MailTransport
    {
        $cfg  = App::config('mail', []);
        $mode = $cfg['mode'] ?? 'log';
        if ($mode === 'smtp' && !empty($cfg['smtp']['host'])) {
            return new MailSmtp($cfg['smtp']);
        }
        return new MailLog();
    }

    /** True si un vrai transport (SMTP configuré) est actif. */
    public static function estReel(): bool
    {
        $cfg = App::config('mail', []);
        return ($cfg['mode'] ?? 'log') === 'smtp' && !empty($cfg['smtp']['host']);
    }

    public static function envoyer(string $to, string $sujet, string $html): array
    {
        $cfg = App::config('mail', []);
        return self::transport()->envoyer([
            'to'       => $to,
            'subject'  => $sujet,
            'html'     => $html,
            'from'     => $cfg['from'] ?? 'no-reply@coachlink.ci',
            'from_nom' => $cfg['from_nom'] ?? 'CoachLink CI',
        ]);
    }

    /** Construit une URL du front (pour les liens dans les emails). */
    public static function lienFront(string $routeHash): string
    {
        $base = rtrim(App::config('mail', [])['app_url'] ?? '', '/');
        return $base . '/' . ltrim($routeHash, '/');
    }

    /** Gabarit HTML minimal et sobre pour les emails transactionnels. */
    public static function gabarit(string $titre, string $corpsHtml): string
    {
        return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">'
            . '<div style="background:#1b4dcc;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">'
            . '<strong style="font-size:18px">CoachLink CI</strong></div>'
            . '<div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px">'
            . '<h2 style="margin:0 0 12px;font-size:18px">' . htmlspecialchars($titre) . '</h2>'
            . $corpsHtml
            . '<p style="color:#94a3b8;font-size:12px;margin-top:24px">Vous recevez cet email car une action a été demandée sur CoachLink CI. '
            . 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.</p>'
            . '</div></div>';
    }
}

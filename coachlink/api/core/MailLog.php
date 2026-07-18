<?php
/* ==========================================================================
   core/MailLog.php — Transport d'email de démonstration (par défaut).
   N'envoie rien : écrit l'email dans un fichier .eml (hors du dépôt). Permet de
   développer/tester sans serveur SMTP. Passez en mode 'smtp' en production.
   ========================================================================== */

class MailLog implements MailTransport
{
    public function envoyer(array $mail): array
    {
        $dir = rtrim(App::config('cache_dir', sys_get_temp_dir() . '/coachlink-cache'), '/') . '/mails';
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return ['ok' => false, 'message' => 'Dossier de log des emails inaccessible.'];
        }
        $fichier = $dir . '/' . date('Ymd-His') . '-' . substr(md5(($mail['to'] ?? '') . microtime()), 0, 8) . '.eml';
        $contenu = "To: " . ($mail['to'] ?? '') . "\n"
            . "From: " . ($mail['from_nom'] ?? 'CoachLink CI') . " <" . ($mail['from'] ?? '') . ">\n"
            . "Subject: " . ($mail['subject'] ?? '') . "\n"
            . "Content-Type: text/html; charset=UTF-8\n\n"
            . ($mail['html'] ?? '') . "\n";
        @file_put_contents($fichier, $contenu);
        return ['ok' => true, 'message' => 'Email journalisé (mode démo).', 'fichier' => $fichier];
    }
}

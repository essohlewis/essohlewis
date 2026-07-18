<?php
/* ==========================================================================
   core/MailTransport.php — Contrat d'un transport d'email.
   Une implémentation « log » (démo, testable) et une implémentation SMTP réelle.
   ========================================================================== */

interface MailTransport
{
    /**
     * Envoie un email.
     * $mail = { to, subject, html, from, from_nom }
     * @return array{ok:bool, message:?string, fichier?:?string}
     */
    public function envoyer(array $mail): array;
}

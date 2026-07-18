<?php
/* ==========================================================================
   controllers/HealthController.php — Points de santé de l'API.
   ========================================================================== */

class HealthController
{
    public function racine(array $params): void
    {
        Response::ok(['api' => 'CoachLink CI', 'version' => 1, 'statut' => 'en ligne']);
    }

    public function ping(array $params): void
    {
        // Vérifie aussi la connexion à la base.
        try {
            Database::connexion()->query('SELECT 1');
            $db = 'ok';
        } catch (Throwable $e) {
            $db = 'indisponible';
        }
        Response::ok(['pong' => true, 'db' => $db, 'heure' => date('c')]);
    }
}

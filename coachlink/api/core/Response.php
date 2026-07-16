<?php
/* ==========================================================================
   core/Response.php — Réponses HTTP JSON normalisées.
   ========================================================================== */

class Response
{
    /** Envoie une réponse JSON et arrête l'exécution. */
    public static function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Réponse de succès : { ok: true, data: ... }. */
    public static function ok($data = null, int $code = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $code);
    }

    /** Réponse d'erreur : { ok: false, message, erreurs }. */
    public static function erreur(string $message, int $code = 400, array $erreurs = []): void
    {
        self::json(['ok' => false, 'message' => $message, 'erreurs' => $erreurs], $code);
    }
}

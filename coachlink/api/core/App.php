<?php
/* ==========================================================================
   core/App.php — Amorçage : configuration, autoload, CORS, gestion d'erreurs.
   ========================================================================== */

class App
{
    private static array $config = [];

    /**
     * Amorçage. En temps normal, charge config.php (ou config.example.php).
     * Les tests peuvent injecter une configuration ($override) et sauter
     * l'envoi des en-têtes HTTP ($http = false).
     */
    public static function boot(?array $override = null, bool $http = true): void
    {
        if ($override !== null) {
            self::$config = $override;
        } else {
            $dir = __DIR__ . '/../config/';
            $fichier = is_file($dir . 'config.php') ? $dir . 'config.php' : $dir . 'config.example.php';
            self::$config = require $fichier;
        }

        self::autoload();
        if ($http) {
            self::securite();
            self::cors();
        }
        self::gestionErreurs();
    }

    /** Accès à une clé de configuration. */
    public static function config(string $cle, $defaut = null)
    {
        return self::$config[$cle] ?? $defaut;
    }

    /** Autoloader PSR-0 simple pour core/ models/ controllers/. */
    private static function autoload(): void
    {
        spl_autoload_register(function (string $classe) {
            foreach (['core', 'models', 'controllers'] as $dossier) {
                $chemin = __DIR__ . '/../' . $dossier . '/' . $classe . '.php';
                if (is_file($chemin)) {
                    require $chemin;
                    return;
                }
            }
        });
    }

    /** En-têtes CORS + réponse aux requêtes preflight OPTIONS. */
    private static function cors(): void
    {
        $origines = self::config('cors_origins', ['*']);
        $origine  = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array('*', $origines, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif (in_array($origine, $origines, true)) {
            header('Access-Control-Allow-Origin: ' . $origine);
            header('Vary: Origin');
        }
        header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Expose-Headers: X-Total-Count, Retry-After');

        if (Request::methode() === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    /** En-têtes de sécurité appliqués à toutes les réponses de l'API. */
    private static function securite(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        // L'API ne renvoie que du JSON : on interdit tout chargement de ressource
        // et toute inclusion dans une frame.
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }

    /** Convertit les exceptions non gérées en réponses JSON 500. */
    private static function gestionErreurs(): void
    {
        set_exception_handler(function (Throwable $e) {
            Response::erreur('Erreur serveur : ' . $e->getMessage(), 500);
        });
    }
}

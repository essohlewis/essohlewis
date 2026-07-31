<?php

declare(strict_types=1);

/**
 * Front controller — point d'entrée unique de l'application.
 *
 * Toutes les requêtes web sont réécrites vers ce fichier (voir .htaccess).
 * Il initialise l'environnement, charge l'autoload, démarre la session,
 * puis délègue le routage.
 */

// ---------------------------------------------------------------------------
// 0. Serveur intégré PHP (php -S) : sert directement les fichiers existants.
//    Sous Apache/Nginx, cette réécriture est gérée par .htaccess et ce bloc
//    est simplement ignoré.
// ---------------------------------------------------------------------------
if (PHP_SAPI === 'cli-server') {
    $requested = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
    $file = __DIR__ . $requested;
    if ($requested !== '/' && is_file($file)) {
        return false; // Laisse le serveur intégré servir l'asset.
    }
}

// ---------------------------------------------------------------------------
// 1. Configuration & constantes
// ---------------------------------------------------------------------------
require dirname(__DIR__) . '/config/config.php';

// Affichage des erreurs selon l'environnement.
if (APP_ENV === 'dev') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// ---------------------------------------------------------------------------
// 2. Autoload PSR-4 maison (aucun Composer requis)
// ---------------------------------------------------------------------------
spl_autoload_register(static function (string $class): void {
    // Espace de noms racine : App\  ->  app/
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = APP_PATH . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

// Helpers procéduraux (fonctions globales : e(), url(), fcfa(), ...).
require APP_PATH . '/Helpers/functions.php';
require APP_PATH . '/Helpers/operator_detect.php';

// ---------------------------------------------------------------------------
// 3. Session sécurisée + en-têtes de sécurité
// ---------------------------------------------------------------------------
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\Session;

Session::start();
Response::securityHeaders();

// ---------------------------------------------------------------------------
// 4. Routage
// ---------------------------------------------------------------------------
$router = new Router();
require ROOT_PATH . '/routes/web.php';

try {
    $router->dispatch(new Request());
} catch (Throwable $e) {
    // Erreur serveur : on log en interne, on affiche une page générique.
    error_log('[GuideRecharge] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::status(500);
    if (APP_ENV === 'dev') {
        echo '<pre style="padding:1rem;font-family:monospace">';
        echo 'Erreur : ' . htmlspecialchars($e->getMessage(), ENT_QUOTES) . "\n";
        echo htmlspecialchars($e->getFile() . ':' . $e->getLine(), ENT_QUOTES) . "\n\n";
        echo htmlspecialchars($e->getTraceAsString(), ENT_QUOTES);
        echo '</pre>';
    } else {
        $errorFile = VIEW_PATH . '/errors/500.php';
        if (is_file($errorFile)) {
            $title = 'Erreur serveur';
            ob_start();
            require $errorFile;
            $content = ob_get_clean();
            require VIEW_PATH . '/layouts/main.php';
        } else {
            echo 'Une erreur interne est survenue.';
        }
    }
}

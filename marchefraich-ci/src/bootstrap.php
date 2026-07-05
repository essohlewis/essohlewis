<?php
/**
 * Amorçage de l'application : autoload, configuration, connexion DB.
 *
 * Aucun framework : un autoloader PSR-4 minimal suffit pour charger les
 * classes du namespace App\ depuis le dossier src/.
 */

declare(strict_types=1);

// --- Configuration ---
$config = require BASE_PATH . '/config/config.php';

// Exposée aux helpers de vues pour construire les URLs.
$GLOBALS['APP_BASE_URL'] = $config['app']['base_url'];

// --- Affichage des erreurs selon le mode ---
if ($config['app']['debug']) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(0);
}

// --- Autoloader PSR-4 pour le namespace App\ ---
spl_autoload_register(static function (string $classe): void {
    $prefixe = 'App\\';
    if (!str_starts_with($classe, $prefixe)) {
        return;
    }
    $relative = substr($classe, strlen($prefixe));
    $fichier  = SRC_PATH . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($fichier)) {
        require $fichier;
    }
});

// --- Helpers globaux ---
require SRC_PATH . '/Core/helpers.php';

// --- Connexion à la base de données (partagée) ---
\App\Core\Database::connexion($config['db']);

return $config;

<?php
/**
 * MarchéFraîch CI — Configuration centrale
 *
 * Les valeurs peuvent être surchargées par des variables d'environnement
 * (utile pour un déploiement sur VPS mutualisé sans modifier le code).
 * Copiez ce comportement en définissant les variables côté serveur.
 */

declare(strict_types=1);

// Chemins racine (le front controller les définit déjà ; on complète
// pour les usages en ligne de commande / tests où ils manqueraient).
defined('BASE_PATH')   || define('BASE_PATH', dirname(__DIR__));
defined('SRC_PATH')    || define('SRC_PATH', BASE_PATH . '/src');
defined('VIEW_PATH')   || define('VIEW_PATH', SRC_PATH . '/Views');
defined('UPLOAD_PATH') || define('UPLOAD_PATH', BASE_PATH . '/public/uploads');

/**
 * Petit helper : lit une variable d'environnement avec valeur par défaut.
 */
function env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value !== false ? $value : $default;
}

return [
    // Application
    'app' => [
        'nom'      => 'MarchéFraîch CI',
        'devise'   => 'XOF',
        'base_url' => env('APP_BASE_URL', ''), // ex: '' si à la racine, '/marchefraich-ci/public' sinon
        'debug'    => env('APP_DEBUG', '1') === '1',
    ],

    // Base de données MySQL
    'db' => [
        'host'    => env('DB_HOST', '127.0.0.1'),
        'port'    => env('DB_PORT', '3306'),
        'name'    => env('DB_NAME', 'marchefraich'),
        'user'    => env('DB_USER', 'root'),
        'pass'    => env('DB_PASS', ''),
        'charset' => 'utf8mb4',
    ],

    // Règles métier (modèle économique)
    'business' => [
        // Commission plateforme prélevée sur le montant des produits (en %)
        'taux_commission'    => (float) env('TAUX_COMMISSION', '5'),
        // Frais de livraison fixes par commande (XOF)
        'frais_livraison'    => (int) env('FRAIS_LIVRAISON', '500'),
    ],

    // Paiement CinetPay (agrégateur Orange Money / MTN Money / Wave)
    // En MVP, l'intégration réelle est encapsulée et bascule en mode
    // simulation si les clés ne sont pas renseignées.
    'cinetpay' => [
        'api_key'  => env('CINETPAY_API_KEY', ''),
        'site_id'  => env('CINETPAY_SITE_ID', ''),
        'mode'     => env('CINETPAY_MODE', 'simulation'), // 'simulation' | 'production'
        'notify_url' => env('CINETPAY_NOTIFY_URL', ''),
    ],
];

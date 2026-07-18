<?php
/* ==========================================================================
   deploy/config.production.php — Configuration de PRODUCTION.

   Ce fichier ne contient AUCUN secret : il lit toutes les valeurs sensibles
   depuis l'environnement (fichier config/coachlink.env, non versionné, chmod
   600). setup.sh le copie en api/config/config.php.

   Les secrets vivent donc dans un seul fichier protégé (coachlink.env),
   chargé ci-dessous pour le CLI (migrate) comme pour le serveur web.
   ========================================================================== */

// Charge coachlink.env s'il existe (sans écraser un env déjà défini par le
// serveur web / systemd). Parseur .env simple : commentaires # ou ; et KEY=VALEUR.
$__env = __DIR__ . '/coachlink.env';
if (is_file($__env)) {
    foreach (file($__env, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $__ligne) {
        $__ligne = trim($__ligne);
        if ($__ligne === '' || $__ligne[0] === '#' || $__ligne[0] === ';') {
            continue;
        }
        $__pos = strpos($__ligne, '=');
        if ($__pos === false) {
            continue;
        }
        $__k = trim(substr($__ligne, 0, $__pos));
        $__v = trim(trim(substr($__ligne, $__pos + 1)), "\"'");
        if ($__k !== '' && getenv($__k) === false) {
            putenv("$__k=$__v");
            $_ENV[$__k] = $__v;
        }
    }
}

$env = fn(string $c, $def = '') => (getenv($c) !== false && getenv($c) !== '') ? getenv($c) : $def;
$bool = fn(string $c) => in_array(strtolower((string) $env($c)), ['1', 'true', 'yes', 'on'], true);

return [
    // --- Base de données --------------------------------------------------
    'db' => [
        'driver'      => $env('CL_DB_DRIVER', 'mysql'),
        'host'        => $env('CL_DB_HOST', '127.0.0.1'),
        'port'        => (int) $env('CL_DB_PORT', '3306'),
        'name'        => $env('CL_DB_NAME', 'coachlink'),
        'user'        => $env('CL_DB_USER', 'coachlink'),
        'password'    => $env('CL_DB_PASSWORD', ''),
        'charset'     => 'utf8mb4',
        'sqlite_path' => $env('CL_SQLITE_PATH', __DIR__ . '/../database/coachlink.sqlite'),
    ],

    // --- Sécurité ---------------------------------------------------------
    'jwt_secret' => $env('CL_JWT_SECRET', 'CHANGEZ-MOI-secret-absent'),
    'jwt_ttl'    => (int) $env('CL_JWT_TTL', (string) (60 * 60 * 24 * 7)),

    // --- CORS : domaine(s) du front, séparés par des virgules -------------
    'cors_origins' => array_values(array_filter(array_map('trim', explode(',', $env('CL_CORS_ORIGINS', ''))))) ?: ['*'],

    // --- Uploads ----------------------------------------------------------
    'uploads_dir' => $env('CL_UPLOADS_DIR', __DIR__ . '/../uploads'),
    'uploads_url' => $env('CL_UPLOADS_URL', '/api/uploads'),
    'max_upload'  => (int) $env('CL_MAX_UPLOAD', (string) (8 * 1024 * 1024)),

    // --- Débit / cache ----------------------------------------------------
    'rate_limit' => [
        'global' => (int) $env('CL_RL_GLOBAL', '240'),
        'auth'   => (int) $env('CL_RL_AUTH', '12'),
    ],
    'cache_dir' => $env('CL_CACHE_DIR', sys_get_temp_dir() . '/coachlink-cache'),

    // --- Paiement Mobile Money -------------------------------------------
    'paiement' => [
        'mode'            => $env('CL_PAY_MODE', 'simulateur'), // 'reel' pour activer
        'callback_url'    => $env('CL_PAY_CALLBACK_URL', ''),
        'callback_secret' => $env('CL_PAY_CALLBACK_SECRET', ''),
        'orange' => [
            'actif'         => $bool('CL_PAY_ORANGE_ACTIF'),
            'base_url'      => $env('CL_PAY_ORANGE_BASE', 'https://api.orange.com'),
            'client_id'     => $env('CL_PAY_ORANGE_ID'),
            'client_secret' => $env('CL_PAY_ORANGE_SECRET'),
            'x_auth_token'  => $env('CL_PAY_ORANGE_XAUTH'),
        ],
        'wave' => [
            'actif'       => $bool('CL_PAY_WAVE_ACTIF'),
            'base_url'    => $env('CL_PAY_WAVE_BASE', 'https://api.wave.com'),
            'api_key'     => $env('CL_PAY_WAVE_KEY'),
            'success_url' => $env('CL_PAY_WAVE_SUCCESS'),
            'error_url'   => $env('CL_PAY_WAVE_ERROR'),
        ],
        'mtn' => [
            'actif'            => $bool('CL_PAY_MTN_ACTIF'),
            'base_url'         => $env('CL_PAY_MTN_BASE', 'https://sandbox.momodeveloper.mtn.com'),
            'api_user'         => $env('CL_PAY_MTN_USER'),
            'api_key'          => $env('CL_PAY_MTN_KEY'),
            'subscription_key' => $env('CL_PAY_MTN_SUBKEY'),
            'environnement'    => $env('CL_PAY_MTN_ENV', 'sandbox'),
            'devise'           => 'XOF',
        ],
        'moov' => [
            'actif'         => $bool('CL_PAY_MOOV_ACTIF'),
            'base_url'      => $env('CL_PAY_MOOV_BASE'),
            'client_id'     => $env('CL_PAY_MOOV_ID'),
            'client_secret' => $env('CL_PAY_MOOV_SECRET'),
        ],
    ],

    // --- Email ------------------------------------------------------------
    'mail' => [
        'mode'     => $env('CL_MAIL_MODE', 'log'), // 'smtp' pour activer
        'from'     => $env('CL_MAIL_FROM', 'no-reply@coachlink.ci'),
        'from_nom' => $env('CL_MAIL_FROM_NOM', 'CoachLink CI'),
        'app_url'  => $env('CL_APP_URL', ''),
        'smtp' => [
            'host'        => $env('CL_SMTP_HOST'),
            'port'        => (int) $env('CL_SMTP_PORT', '587'),
            'chiffrement' => $env('CL_SMTP_CHIFFREMENT', 'tls'),
            'user'        => $env('CL_SMTP_USER'),
            'password'    => $env('CL_SMTP_PASSWORD'),
        ],
    ],

    // --- Connexion sociale (OAuth) ---------------------------------------
    'oauth' => [
        'redirect_base' => $env('CL_OAUTH_REDIRECT_BASE', ''),
        'front_url'     => $env('CL_APP_URL', ''),
        'facebook' => [
            'actif'         => $bool('CL_OAUTH_FB_ACTIF'),
            'client_id'     => $env('CL_OAUTH_FB_ID'),
            'client_secret' => $env('CL_OAUTH_FB_SECRET'),
        ],
        'linkedin' => [
            'actif'         => $bool('CL_OAUTH_LI_ACTIF'),
            'client_id'     => $env('CL_OAUTH_LI_ID'),
            'client_secret' => $env('CL_OAUTH_LI_SECRET'),
        ],
    ],
];

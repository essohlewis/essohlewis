<?php
/* ==========================================================================
   config/config.example.php — Modèle de configuration.
   Copiez ce fichier en « config.php » puis adaptez les valeurs.
   config.php est ignoré par git (secrets).
   ========================================================================== */

return [
    // --- Base de données --------------------------------------------------
    // Pilote : "mysql" (production) ou "sqlite" (développement/tests).
    'db' => [
        'driver'   => 'mysql',
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'name'     => 'coachlink',
        'user'     => 'root',
        'password' => '',
        'charset'  => 'utf8mb4',
        // Pour SQLite : chemin du fichier (utilisé si driver = "sqlite").
        'sqlite_path' => __DIR__ . '/../database/coachlink.sqlite',
    ],

    // --- Sécurité ---------------------------------------------------------
    // Clé secrète pour signer les JWT. CHANGEZ-LA en production (aléatoire long).
    'jwt_secret'   => 'changez-moi-par-une-cle-secrete-longue-et-aleatoire',
    'jwt_ttl'      => 60 * 60 * 24 * 7, // durée de validité d'un token (7 jours)

    // --- CORS -------------------------------------------------------------
    // Origines autorisées à appeler l'API ("*" en dev, domaine précis en prod).
    'cors_origins' => ['*'],

    // --- Uploads ----------------------------------------------------------
    'uploads_dir'  => __DIR__ . '/../uploads',
    'uploads_url'  => '/api/uploads', // URL publique de base des fichiers
    'max_upload'   => 8 * 1024 * 1024, // 8 Mo

    // --- Limitation de débit (anti-abus / anti-brute-force) ---------------
    // Nombre maximal de requêtes par IP et par fenêtre de 60 s.
    // Mettez 0 pour désactiver un seau.
    'rate_limit' => [
        'global' => 240, // toutes routes confondues
        'auth'   => 12,  // routes sensibles (login, register, mot de passe)
    ],

    // Dossier de cache (compteurs de débit). Hors du dépôt par défaut.
    'cache_dir' => sys_get_temp_dir() . '/coachlink-cache',

    // --- Paiement Mobile Money -------------------------------------------
    // 'mode' : 'simulateur' (démo, aucun appel réseau, code à 4 chiffres) ou
    // 'reel' (utilise les passerelles opérateurs pour lesquelles actif=true).
    // Tant qu'un opérateur n'est pas 'actif' + configuré, on retombe sur le
    // simulateur : l'application marche sans identifiant.
    'paiement' => [
        'mode'            => 'simulateur',
        'callback_url'    => '', // URL publique HTTPS recevant les webhooks opérateurs
        'callback_secret' => '', // secret partagé attendu dans l'en-tête X-Callback-Secret
        'orange' => [
            'actif'         => false,
            'base_url'      => 'https://api.orange.com',
            'client_id'     => '',
            'client_secret' => '',
            'x_auth_token'  => '',
        ],
        'wave' => [
            'actif'       => false,
            'base_url'    => 'https://api.wave.com',
            'api_key'     => '',
            'success_url' => '',
            'error_url'   => '',
        ],
        'mtn' => [
            'actif'            => false,
            'base_url'         => 'https://sandbox.momodeveloper.mtn.com', // prod : URL partenaire
            'api_user'         => '',
            'api_key'          => '',
            'subscription_key' => '',
            'environnement'    => 'sandbox', // 'sandbox' | 'production'
            'devise'           => 'XOF',
        ],
        'moov' => [
            'actif'         => false,
            'base_url'      => '', // fournie par votre agrégateur Moov Africa
            'client_id'     => '',
            'client_secret' => '',
        ],
    ],

    // --- Email ------------------------------------------------------------
    // 'mode' : 'log' (démo — les emails sont écrits dans cache_dir/mails, rien
    // n'est envoyé) ou 'smtp' (envoi réel via le serveur configuré ci-dessous).
    'mail' => [
        'mode'     => 'log',
        'from'     => 'no-reply@coachlink.ci',
        'from_nom' => 'CoachLink CI',
        // URL publique du front, pour construire les liens des emails
        // (ex : 'https://coachlink.ci'). Laissez vide en développement.
        'app_url'  => '',
        'smtp' => [
            'host'        => '',      // ex : smtp.gmail.com, smtp.sendgrid.net…
            'port'        => 587,
            'chiffrement' => 'tls',   // 'tls' | 'ssl' | ''
            'user'        => '',
            'password'    => '',
        ],
    ],
];

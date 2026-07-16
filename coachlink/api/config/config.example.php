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
];

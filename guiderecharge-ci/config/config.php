<?php

/**
 * Configuration globale de l'application GuideRecharge CI.
 *
 * Ce fichier centralise toutes les constantes de configuration :
 * connexion à la base de données, URL de base, chemins, et paramètres
 * de sécurité. Il est chargé une seule fois au démarrage (bootstrap).
 *
 * En production, remplacez les identifiants BDD par des variables
 * d'environnement (getenv) pour ne jamais versionner de secrets.
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// Environnement
// ---------------------------------------------------------------------------
// 'dev' affiche les erreurs, 'prod' les masque.
define('APP_ENV', getenv('APP_ENV') ?: 'dev');
define('APP_NAME', 'GuideRecharge CI');

// ---------------------------------------------------------------------------
// Base de données (MySQL 8+, InnoDB, utf8mb4)
// ---------------------------------------------------------------------------
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'guiderecharge_ci');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

// ---------------------------------------------------------------------------
// URL & chemins
// ---------------------------------------------------------------------------
// BASE_URL : préfixe de toutes les URL générées. Laissez '' si le site est
// à la racine du domaine, ou '/guiderecharge-ci/public' sous XAMPP.
define('BASE_URL', getenv('BASE_URL') !== false ? getenv('BASE_URL') : '');

// Chemins absolus des dossiers du projet.
define('ROOT_PATH', dirname(__DIR__));
define('APP_PATH', ROOT_PATH . '/app');
define('VIEW_PATH', APP_PATH . '/Views');
define('PUBLIC_PATH', ROOT_PATH . '/public');

// ---------------------------------------------------------------------------
// Sécurité
// ---------------------------------------------------------------------------
// Durée de vie du token CSRF et paramètres de rate-limiting.
define('CSRF_TOKEN_NAME', '_csrf');
define('SESSION_NAME', 'grc_session');

// Rate-limiting : nombre de tentatives autorisées et fenêtre en secondes.
define('LOGIN_MAX_ATTEMPTS', 5);
define('LOGIN_DECAY_SECONDS', 300);   // 5 minutes
define('USSD_MAX_PER_MINUTE', 30);

// Montants autorisés pour la génération de code (FCFA).
define('MONTANT_MIN', 50);
define('MONTANT_MAX', 100000);

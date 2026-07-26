<?php
declare(strict_types=1);

/**
 * Routeur pour le serveur web intégré de PHP (développement uniquement).
 *
 *   php -S localhost:8080 server.php
 *
 * Sert directement les fichiers statiques existants de public/ (assets, PWA,
 * uploads) et route tout le reste vers le contrôleur frontal public/index.php.
 * En production, c'est Apache (public/.htaccess) ou Nginx qui joue ce rôle.
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . '/public' . $path;

// Fichier statique existant (et pas un dossier) : laisser le serveur le servir.
if ($path !== '/' && is_file($file)) {
    return false;
}

require __DIR__ . '/public/index.php';

<?php
/**
 * Routeur pour le serveur PHP intégré (développement uniquement).
 *   php -S 127.0.0.1:8000 -t public public/router.php
 *
 * Reproduit le comportement du .htaccess Apache : sert les fichiers statiques
 * existants, sinon délègue tout au front controller.
 */

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . $path;

// Sert directement les fichiers statiques existants (assets, médias, PWA).
if ($path !== '/' && is_file($file)) {
    return false;
}

require __DIR__ . '/index.php';

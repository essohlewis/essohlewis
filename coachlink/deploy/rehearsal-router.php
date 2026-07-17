<?php
/* ==========================================================================
   deploy/rehearsal-router.php — Routeur de RÉPÉTITION (test local uniquement).
   Reproduit, avec le serveur PHP intégré, le routage de production servi par
   Apache/Nginx : le front à la racine et l'API sous /api (même origine).

   Usage (depuis coachlink/) :
     php -S 127.0.0.1:8080 deploy/rehearsal-router.php
   ========================================================================== */

$root = dirname(__DIR__); // coachlink/
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

// /api/*  → front controller de l'API (Request::chemin() retire le préfixe /api).
if (preg_match('#^/api(/|$)#', $path)) {
    $fichier = $root . $path;
    // Fichiers téléversés (et autres statiques sous /api) servis directement.
    if ($path !== '/api/' && is_file($fichier) && !str_ends_with($fichier, '.php')) {
        return false;
    }
    require $root . '/api/index.php';
    return true;
}

// Front : fichier statique s'il existe, sinon index.html.
$fichier = $root . $path;
if ($path !== '/' && is_file($fichier)) {
    return false; // le serveur intégré sert le fichier statique
}
header('Content-Type: text/html; charset=UTF-8');
readfile($root . '/index.html');
return true;

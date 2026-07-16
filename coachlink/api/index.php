<?php
/* ==========================================================================
   index.php — Point d'entrée unique de l'API (front controller).
   Toutes les requêtes /api/* sont réécrites vers ce fichier (.htaccess).
   ========================================================================== */

declare(strict_types=1);

require __DIR__ . '/core/App.php';

App::boot();

// Limitation de débit globale (toutes routes) par IP.
$limites = App::config('rate_limit', []);
RateLimiter::verifier('global', (int) ($limites['global'] ?? 240), 60);

$router = new Router();
require __DIR__ . '/routes.php';

$router->dispatch();

<?php
/* ==========================================================================
   index.php — Point d'entrée unique de l'API (front controller).
   Toutes les requêtes /api/* sont réécrites vers ce fichier (.htaccess).
   ========================================================================== */

declare(strict_types=1);

require __DIR__ . '/core/App.php';

App::boot();

$router = new Router();
require __DIR__ . '/routes.php';

$router->dispatch();

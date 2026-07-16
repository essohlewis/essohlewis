<?php
/* ==========================================================================
   routes.php — Table des routes de l'API. Chaque route → [Contrôleur, méthode].
   Préfixe implicite : /api (retiré par Request::chemin()).
   ========================================================================== */

/** @var Router $router */

// --- Authentification ----------------------------------------------------
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/login',    [AuthController::class, 'login']);
$router->get('/auth/me',        [AuthController::class, 'me']);

// --- Coachs --------------------------------------------------------------
$router->get('/coachs',          [CoachController::class, 'index']);
$router->get('/coachs/moi',      [CoachController::class, 'moi']);
$router->patch('/coachs/moi',    [CoachController::class, 'majMoi']);
$router->get('/coachs/:id',      [CoachController::class, 'show']);
$router->post('/coachs/:id/avis', [ReviewController::class, 'ajouter']);
$router->patch('/avis/:id/reponse', [ReviewController::class, 'repondre']);

// --- Réservations --------------------------------------------------------
$router->post('/reservations',            [ReservationController::class, 'creer']);
$router->get('/reservations/mes',         [ReservationController::class, 'mes']);
$router->get('/reservations/coach',       [ReservationController::class, 'pourCoach']);
$router->post('/reservations/:id/payer',  [ReservationController::class, 'payer']);
$router->patch('/reservations/:id/statut', [ReservationController::class, 'statut']);

// --- Notifications -------------------------------------------------------
$router->get('/notifications',              [NotificationController::class, 'index']);
$router->patch('/notifications/:id/lue',    [NotificationController::class, 'lue']);
$router->post('/notifications/toutes-lues', [NotificationController::class, 'toutesLues']);

// --- Messagerie ----------------------------------------------------------
$router->get('/conversations',                  [MessageController::class, 'conversations']);
$router->post('/conversations',                 [MessageController::class, 'ouvrir']);
$router->post('/conversations/:id/messages',    [MessageController::class, 'envoyer']);
$router->post('/conversations/:id/lu',          [MessageController::class, 'marquerLu']);

// --- Administration ------------------------------------------------------
$router->get('/admin/stats',           [AdminController::class, 'stats']);
$router->get('/admin/utilisateurs',    [AdminController::class, 'utilisateurs']);
$router->get('/admin/diplomes',        [AdminController::class, 'diplomesEnAttente']);
$router->patch('/admin/diplomes/:id',  [AdminController::class, 'statutDiplome']);

// --- Santé ---------------------------------------------------------------
$router->get('/',     [HealthController::class, 'racine']);
$router->get('/ping', [HealthController::class, 'ping']);

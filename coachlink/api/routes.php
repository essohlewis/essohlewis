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
$router->post('/auth/mot-de-passe/oubli', [AuthController::class, 'motDePasseOubli']);
$router->post('/auth/mot-de-passe/reset', [AuthController::class, 'reinitialiser']);
$router->get('/auth/oauth/:provider/callback', [AuthController::class, 'oauthCallback']);
$router->get('/auth/oauth/:provider', [AuthController::class, 'oauthUrl']);

// --- Coachs --------------------------------------------------------------
$router->get('/coachs',          [CoachController::class, 'index']);
$router->get('/coachs/moi',      [CoachController::class, 'moi']);
$router->patch('/coachs/moi',    [CoachController::class, 'majMoi']);
// Gestion par le coach connecté (avant /coachs/:id pour éviter les collisions).
$router->post('/coachs/moi/tarifs',           [CoachController::class, 'ajouterTarif']);
$router->delete('/tarifs/:id',                [CoachController::class, 'supprimerTarif']);
$router->put('/coachs/moi/disponibilites',    [CoachController::class, 'majDisponibilites']);
$router->post('/coachs/moi/diplomes',         [CoachController::class, 'ajouterDiplome']);
$router->post('/coachs/moi/galerie',          [CoachController::class, 'ajouterMedia']);
$router->delete('/galerie/:id',               [CoachController::class, 'supprimerMedia']);
$router->post('/coachs/moi/posts',            [CoachController::class, 'ajouterPost']);
$router->delete('/posts/:id',                 [CoachController::class, 'supprimerPost']);
$router->post('/posts/:id/like',              [CoachController::class, 'basculerLike']);
$router->get('/mes-likes',                    [CoachController::class, 'mesLikes']);

$router->get('/coachs/:id',      [CoachController::class, 'show']);
$router->post('/coachs/:id/avis', [ReviewController::class, 'ajouter']);
$router->patch('/avis/:id/reponse', [ReviewController::class, 'repondre']);

// Favoris (client)
$router->get('/favoris',  [FavoriteController::class, 'index']);
$router->post('/favoris', [FavoriteController::class, 'basculer']);

// Litiges
$router->post('/litiges', [LitigeController::class, 'ouvrir']);

// Téléversement de fichiers
$router->post('/uploads', [UploadController::class, 'televerser']);

// --- Réservations --------------------------------------------------------
$router->post('/reservations',            [ReservationController::class, 'creer']);
$router->get('/reservations/mes',         [ReservationController::class, 'mes']);
$router->get('/reservations/coach',       [ReservationController::class, 'pourCoach']);
$router->post('/reservations/:id/payer',  [ReservationController::class, 'payer']);
$router->patch('/reservations/:id/statut', [ReservationController::class, 'statut']);
$router->patch('/reservations/:id/lieu',   [ReservationController::class, 'lieu']);
$router->post('/reservations/:id/valider-presence', [ReservationController::class, 'validerPresence']);

// --- Portefeuille du coach --------------------------------------------------
$router->get('/portefeuille', [PortefeuilleController::class, 'coach']);

// Webhook de confirmation Mobile Money (appelé par l'opérateur).
$router->post('/paiements/callback', [PaiementController::class, 'callback']);

// --- Abonnements mensuels ------------------------------------------------
$router->post('/abonnements',                [AbonnementController::class, 'creer']);
$router->get('/abonnements/mes',             [AbonnementController::class, 'mes']);
$router->get('/abonnements/coach',           [AbonnementController::class, 'pourCoach']);
$router->get('/abonnements/:id',             [AbonnementController::class, 'show']);
$router->patch('/abonnements/:id/programme', [AbonnementController::class, 'programme']);
$router->patch('/abonnements/:id/statut',    [AbonnementController::class, 'statut']);
$router->post('/abonnements/:id/payer',      [AbonnementController::class, 'payer']);

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
$router->get('/admin/reservations',    [AdminController::class, 'reservations']);
$router->get('/admin/litiges',          [AdminController::class, 'litiges']);
$router->patch('/admin/litiges/:id',    [AdminController::class, 'statutLitige']);
$router->get('/admin/diplomes',        [AdminController::class, 'diplomesEnAttente']);
$router->patch('/admin/diplomes/:id',  [AdminController::class, 'statutDiplome']);

// --- Santé ---------------------------------------------------------------
$router->get('/',     [HealthController::class, 'racine']);
$router->get('/ping', [HealthController::class, 'ping']);

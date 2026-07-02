<?php
/**
 * Point d'entrée unique de l'application (front controller).
 * Toutes les requêtes passent ici via la réécriture d'URL (.htaccess).
 */

declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
define('SRC_PATH', BASE_PATH . '/src');
define('VIEW_PATH', SRC_PATH . '/Views');
define('UPLOAD_PATH', BASE_PATH . '/public/uploads');

$config = require SRC_PATH . '/bootstrap.php';

use App\Core\Router;
use App\Controllers\HomeController;
use App\Controllers\AuthController;
use App\Controllers\ClientController;
use App\Controllers\VendeuseController;
use App\Controllers\CoursierController;
use App\Controllers\AdminController;

$router = new Router($config);

// ---------------- Accueil ----------------
$router->get('/', [HomeController::class, 'index']);

// ---------------- Authentification ----------------
// Client
$router->get('/connexion',    [AuthController::class, 'connexionClient']);
$router->post('/connexion',   [AuthController::class, 'connexionClient']);
$router->get('/inscription',  [AuthController::class, 'inscriptionClient']);
$router->post('/inscription', [AuthController::class, 'inscriptionClient']);
$router->get('/deconnexion',  [AuthController::class, 'deconnexionClient']);
// Vendeuse
$router->get('/vendeuse/connexion',    [AuthController::class, 'connexionVendeuse']);
$router->post('/vendeuse/connexion',   [AuthController::class, 'connexionVendeuse']);
$router->get('/vendeuse/inscription',  [AuthController::class, 'inscriptionVendeuse']);
$router->post('/vendeuse/inscription', [AuthController::class, 'inscriptionVendeuse']);
$router->get('/vendeuse/deconnexion',  [AuthController::class, 'deconnexionVendeuse']);
// Coursier
$router->get('/coursier/connexion',    [AuthController::class, 'connexionCoursier']);
$router->post('/coursier/connexion',   [AuthController::class, 'connexionCoursier']);
$router->get('/coursier/inscription',  [AuthController::class, 'inscriptionCoursier']);
$router->post('/coursier/inscription', [AuthController::class, 'inscriptionCoursier']);
$router->get('/coursier/deconnexion',  [AuthController::class, 'deconnexionCoursier']);
// Admin
$router->get('/admin/connexion',   [AuthController::class, 'connexionAdmin']);
$router->post('/admin/connexion',  [AuthController::class, 'connexionAdmin']);
$router->get('/admin/deconnexion', [AuthController::class, 'deconnexionAdmin']);

// ---------------- Espace client ----------------
$router->get('/client',                     [ClientController::class, 'accueil']);
$router->get('/client/marche/{marcheId}',   [ClientController::class, 'catalogue']);
$router->get('/client/boutique/{vendeuseId}', [ClientController::class, 'boutique']);
$router->post('/client/panier/ajouter',     [ClientController::class, 'ajouterPanier']);
$router->get('/client/panier',              [ClientController::class, 'panier']);
$router->post('/client/panier/maj',         [ClientController::class, 'majPanier']);
$router->get('/client/commander',           [ClientController::class, 'commander']);
$router->post('/client/commander',          [ClientController::class, 'validerCommande']);
$router->get('/client/commandes',           [ClientController::class, 'commandes']);
$router->get('/client/commande/{id}',       [ClientController::class, 'commande']);
$router->get('/client/commande/{id}/statut',[ClientController::class, 'statutJson']);

// ---------------- Espace vendeuse ----------------
$router->get('/vendeuse',                          [VendeuseController::class, 'tableauBord']);
$router->get('/vendeuse/produits',                 [VendeuseController::class, 'produits']);
$router->get('/vendeuse/produits/ajouter',         [VendeuseController::class, 'ajouterProduit']);
$router->post('/vendeuse/produits/ajouter',        [VendeuseController::class, 'ajouterProduit']);
$router->get('/vendeuse/produits/{id}/modifier',   [VendeuseController::class, 'modifierProduit']);
$router->post('/vendeuse/produits/{id}/modifier',  [VendeuseController::class, 'modifierProduit']);
$router->post('/vendeuse/produits/{id}/supprimer', [VendeuseController::class, 'supprimerProduit']);
$router->get('/vendeuse/commande/{id}',            [VendeuseController::class, 'commande']);
$router->post('/vendeuse/commande/{id}/statut',    [VendeuseController::class, 'changerStatut']);

// ---------------- Espace coursier ----------------
$router->get('/coursier',                    [CoursierController::class, 'tableauBord']);
$router->post('/coursier/course/{id}/accepter', [CoursierController::class, 'accepter']);
$router->post('/coursier/course/{id}/terminer', [CoursierController::class, 'terminer']);
$router->post('/coursier/disponibilite',     [CoursierController::class, 'basculerDisponibilite']);

// ---------------- Espace administrateur ----------------
$router->get('/admin',           [AdminController::class, 'tableauBord']);
$router->get('/admin/marches',   [AdminController::class, 'marches']);
$router->post('/admin/marches',  [AdminController::class, 'marches']);
$router->get('/admin/vendeuses', [AdminController::class, 'vendeuses']);
$router->post('/admin/vendeuses',[AdminController::class, 'vendeuses']);
$router->get('/admin/coursiers', [AdminController::class, 'coursiers']);

$router->dispatch();

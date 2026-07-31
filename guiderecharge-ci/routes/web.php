<?php

declare(strict_types=1);

/**
 * Déclaration des routes de l'application.
 *
 * Reçoit l'instance $router (App\Core\Router) depuis le front controller.
 * Convention : les routes publiques d'abord, l'admin ensuite.
 */

use App\Controllers\CompareController;
use App\Controllers\ForfaitController;
use App\Controllers\GuideController;
use App\Controllers\HomeController;
use App\Controllers\SearchController;
use App\Controllers\UssdController;
use App\Controllers\Admin\AuthController;
use App\Controllers\Admin\CodeUssdController;
use App\Controllers\Admin\DashboardController;
use App\Controllers\Admin\ForfaitAdminController;
use App\Controllers\Admin\GuideAdminController;
use App\Controllers\Admin\OperateurController;
use App\Core\Router;

/** @var Router $router */

// ---------------------------------------------------------------------------
// Front public
// ---------------------------------------------------------------------------
$router->get('/', [HomeController::class, 'index']);

// Catalogue des forfaits + API filtres
$router->get('/forfaits', [ForfaitController::class, 'index']);
$router->get('/api/forfaits', [ForfaitController::class, 'apiList']);
$router->get('/forfait/{id}', [ForfaitController::class, 'show']);

// Comparateur
$router->get('/comparer', [CompareController::class, 'index']);
$router->get('/api/comparer', [CompareController::class, 'apiCompare']);

// Générateur de code USSD (fonctionnalité phare)
$router->get('/generateur', [UssdController::class, 'index']);
$router->post('/api/generer-code', [UssdController::class, 'generate']);

// Guides & informations
$router->get('/guides', [GuideController::class, 'index']);
$router->get('/guide/{slug}', [GuideController::class, 'show']);

// Recherche globale
$router->get('/recherche', [SearchController::class, 'index']);
$router->get('/api/recherche', [SearchController::class, 'api']);

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
$router->get('/admin/login', [AuthController::class, 'showLogin']);
$router->post('/admin/login', [AuthController::class, 'login']);
$router->post('/admin/logout', [AuthController::class, 'logout']);

$router->get('/admin', [DashboardController::class, 'index']);

// CRUD Opérateurs
$router->get('/admin/operateurs', [OperateurController::class, 'index']);
$router->get('/admin/operateurs/create', [OperateurController::class, 'create']);
$router->post('/admin/operateurs', [OperateurController::class, 'store']);
$router->get('/admin/operateurs/{id}/edit', [OperateurController::class, 'edit']);
$router->post('/admin/operateurs/{id}', [OperateurController::class, 'update']);
$router->post('/admin/operateurs/{id}/delete', [OperateurController::class, 'destroy']);

// CRUD Forfaits
$router->get('/admin/forfaits', [ForfaitAdminController::class, 'index']);
$router->get('/admin/forfaits/create', [ForfaitAdminController::class, 'create']);
$router->post('/admin/forfaits', [ForfaitAdminController::class, 'store']);
$router->get('/admin/forfaits/{id}/edit', [ForfaitAdminController::class, 'edit']);
$router->post('/admin/forfaits/{id}', [ForfaitAdminController::class, 'update']);
$router->post('/admin/forfaits/{id}/delete', [ForfaitAdminController::class, 'destroy']);

// CRUD Codes USSD
$router->get('/admin/codes', [CodeUssdController::class, 'index']);
$router->get('/admin/codes/create', [CodeUssdController::class, 'create']);
$router->post('/admin/codes', [CodeUssdController::class, 'store']);
$router->get('/admin/codes/{id}/edit', [CodeUssdController::class, 'edit']);
$router->post('/admin/codes/{id}', [CodeUssdController::class, 'update']);
$router->post('/admin/codes/{id}/delete', [CodeUssdController::class, 'destroy']);

// CRUD Guides
$router->get('/admin/guides', [GuideAdminController::class, 'index']);
$router->get('/admin/guides/create', [GuideAdminController::class, 'create']);
$router->post('/admin/guides', [GuideAdminController::class, 'store']);
$router->get('/admin/guides/{id}/edit', [GuideAdminController::class, 'edit']);
$router->post('/admin/guides/{id}', [GuideAdminController::class, 'update']);
$router->post('/admin/guides/{id}/delete', [GuideAdminController::class, 'destroy']);

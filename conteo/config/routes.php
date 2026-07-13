<?php

declare(strict_types=1);

use App\Controllers\Admin\DashboardController;
use App\Controllers\Admin\TaleAdminController;
use App\Controllers\Admin\UserAdminController;
use App\Controllers\Api\AuthController;
use App\Controllers\Api\PackController;
use App\Controllers\Api\PaymentController;
use App\Controllers\Api\ProfileController;
use App\Controllers\Api\ProgressController;
use App\Controllers\Api\TaleController;
use App\Controllers\Api\WebhookController;
use App\Core\Router;

/**
 * Déclaration des routes. Le 4ᵉ argument (true) active le middleware d'auth
 * par Bearer token.
 *
 * @param Router $router
 */
return static function (Router $router): void {
    // ─── Auth ───
    $router->post('/api/v1/auth/register',   [AuthController::class, 'register']);
    $router->post('/api/v1/auth/verify-otp', [AuthController::class, 'verifyOtp']);
    $router->post('/api/v1/auth/login',      [AuthController::class, 'login']);
    $router->post('/api/v1/auth/logout',     [AuthController::class, 'logout'], true);
    $router->get('/api/v1/auth/me',          [AuthController::class, 'me'], true);
    $router->delete('/api/v1/auth/me',       [AuthController::class, 'deleteAccount'], true);

    // ─── Profils ───
    $router->get('/api/v1/profiles',         [ProfileController::class, 'index'], true);
    $router->post('/api/v1/profiles',        [ProfileController::class, 'store'], true);
    $router->patch('/api/v1/profiles/{id}',  [ProfileController::class, 'update'], true);
    $router->delete('/api/v1/profiles/{id}', [ProfileController::class, 'destroy'], true);

    // ─── Catalogue ───
    $router->get('/api/v1/tales',            [TaleController::class, 'index'], true);
    $router->get('/api/v1/tales/{slug}',     [TaleController::class, 'show'], true);
    $router->get('/api/v1/packs',            [PackController::class, 'index'], true);
    $router->get('/api/v1/packs/{slug}/download', [PackController::class, 'download'], true);

    // ─── Progression ───
    $router->post('/api/v1/progress',            [ProgressController::class, 'store'], true);
    $router->get('/api/v1/progress/{child_id}',  [ProgressController::class, 'show'], true);
    $router->post('/api/v1/screen-time',         [ProgressController::class, 'screenTime'], true);

    // ─── Paiement ───
    $router->get('/api/v1/plans',                 [PaymentController::class, 'plans']);
    $router->post('/api/v1/payments/initiate',    [PaymentController::class, 'initiate'], true);
    $router->get('/api/v1/payments/{reference}',  [PaymentController::class, 'status'], true);

    // ─── Webhooks (publics : whitelist IP + re-vérification serveur) ───
    $router->post('/api/v1/webhooks/cinetpay', [WebhookController::class, 'cinetpay']);
    $router->post('/api/v1/webhooks/paydunya', [WebhookController::class, 'paydunya']);

    // ─── Back-office admin (session) ───
    $router->get('/admin/login',    [DashboardController::class, 'loginForm']);
    $router->post('/admin/login',   [DashboardController::class, 'login']);
    $router->get('/admin/logout',   [DashboardController::class, 'logout']);
    $router->get('/admin',          [DashboardController::class, 'index']);
    $router->get('/admin/tales',        [TaleAdminController::class, 'index']);
    $router->get('/admin/tales/new',    [TaleAdminController::class, 'createForm']);
    $router->post('/admin/tales',       [TaleAdminController::class, 'store']);
    $router->post('/admin/tales/{id}/delete', [TaleAdminController::class, 'destroy']);
    $router->get('/admin/users',        [UserAdminController::class, 'index']);
    $router->get('/admin/payments',     [UserAdminController::class, 'payments']);
};

<?php

declare(strict_types=1);

use Transouscris\Core\Router;
use Transouscris\Middleware\AdminMiddleware;
use Transouscris\Middleware\AuthMiddleware;
use Transouscris\Middleware\CsrfMiddleware;
use Transouscris\Middleware\RateLimitMiddleware;

/**
 * Table de routage de Transouscris.
 *
 * Middlewares :
 *   - CsrfMiddleware       : toutes les routes web mutantes (hors webhooks).
 *   - AuthMiddleware       : espace connecté.
 *   - AdminMiddleware      : back-office.
 *   - RateLimitMiddleware  : OTP et paiement.
 */
return function (Router $r): void {

    // ── Pages publiques ───────────────────────────────────────
    $r->get('/', 'HomeController@landing');

    // ── Authentification (OTP) ────────────────────────────────
    $r->get('/login', 'AuthController@showLogin');
    $r->post('/auth/otp/request', 'AuthController@requestOtp', [CsrfMiddleware::class, RateLimitMiddleware::class]);
    $r->post('/auth/otp/verify',  'AuthController@verifyOtp',  [CsrfMiddleware::class, RateLimitMiddleware::class]);
    $r->post('/logout', 'AuthController@logout', [CsrfMiddleware::class]);

    // ── Espace connecté ───────────────────────────────────────
    $r->group(['middleware' => [AuthMiddleware::class]], function (Router $r): void {
        $r->get('/dashboard', 'HomeController@dashboard');

        // Portefeuille
        $r->get('/wallet', 'WalletController@show');
        $r->post('/wallet/topup', 'WalletController@topup', [CsrfMiddleware::class, RateLimitMiddleware::class]);

        // Recharge
        $r->get('/recharge', 'RechargeController@form');
        $r->post('/recharge/detect', 'RechargeController@detect', [CsrfMiddleware::class]);
        $r->get('/recharge/plans/{operator}', 'RechargeController@plans');
        $r->post('/recharge', 'RechargeController@submit', [CsrfMiddleware::class]);
        $r->get('/recharge/{id}/receipt', 'RechargeController@receipt');

        // Recharges programmées (récurrentes)
        $r->get('/programmees', 'ScheduledRechargeController@index');
        $r->post('/programmees', 'ScheduledRechargeController@store', [CsrfMiddleware::class]);
        $r->post('/programmees/{id}/toggle', 'ScheduledRechargeController@toggle', [CsrfMiddleware::class]);
        $r->post('/programmees/{id}/executer', 'ScheduledRechargeController@runNow', [CsrfMiddleware::class]);
        $r->delete('/programmees/{id}', 'ScheduledRechargeController@destroy', [CsrfMiddleware::class]);

        // Cagnottes (création)
        $r->post('/cagnotte', 'PotController@create', [CsrfMiddleware::class]);

        // Agents
        $r->get('/agents', 'AgentController@index');
        $r->post('/agents/availability', 'AgentController@toggleAvailability', [CsrfMiddleware::class]);
        $r->post('/agents/{id}/rate', 'AgentController@rate', [CsrfMiddleware::class]);
    });

    // ── Cagnottes publiques (lien partageable) ────────────────
    $r->get('/cagnotte/{slug}', 'PotController@showPublic');
    $r->post('/cagnotte/{slug}/contribuer', 'PotController@contribute', [CsrfMiddleware::class, RateLimitMiddleware::class]);

    // ── Paiement : webhooks (SANS CSRF — signature HMAC) + retour ──
    $r->post('/webhooks/{gateway}', 'PaymentController@webhook', [RateLimitMiddleware::class]);
    $r->get('/payment/return', 'PaymentController@returnPage');

    // ── Simulateur de paiement (DÉVELOPPEMENT — 404 hors APP_DEBUG) ──
    $r->get('/dev/pay', 'DevPaymentController@show');
    $r->post('/dev/pay/confirm', 'DevPaymentController@confirm', [CsrfMiddleware::class]);
    $r->post('/dev/pay/cancel', 'DevPaymentController@cancel', [CsrfMiddleware::class]);

    // ── Back-office admin ─────────────────────────────────────
    $r->group(['prefix' => '/admin', 'middleware' => [AuthMiddleware::class, AdminMiddleware::class]], function (Router $r): void {
        $r->get('', 'Admin\AdminController@dashboard');
        $r->get('/transactions', 'Admin\AdminController@transactions');
        $r->get('/agents', 'Admin\AdminController@agents');
    });
};

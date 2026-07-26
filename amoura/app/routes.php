<?php
declare(strict_types=1);

/**
 * Table de routage de l'application.
 * Retourne une closure qui reçoit le Router et déclare toutes les routes.
 */

use Amoura\Core\Router;
use Amoura\Middleware\Authenticate;
use Amoura\Middleware\VerifyCsrf;
use Amoura\Middleware\RequireStaff;
use Amoura\Middleware\RedirectIfAuth;

return function (Router $r): void {

    // ── Public / vitrine ────────────────────────────────────────────────
    $r->get('/', 'Amoura\Controllers\HomeController@landing');
    $r->get('/p/{slug}', 'Amoura\Controllers\HomeController@page');
    $r->get('/health', fn() => \Amoura\Core\Response::ok(['service' => 'amoura']));

    // Changement de langue (i18n) — cookie persistant, redirection sûre (chemin local).
    $r->get('/lang/{locale}', function ($request, $params) {
        $loc = (string) $params['locale'];
        if (\Amoura\Core\I18n::isAvailable($loc)) {
            setcookie('amoura_lang', $loc, [
                'expires' => time() + 31536000, 'path' => '/', 'httponly' => false, 'samesite' => 'Lax',
            ]);
        }
        $ref = $_SERVER['HTTP_REFERER'] ?? '/';
        $path = parse_url($ref, PHP_URL_PATH) ?: '/';   // ignore l'hôte → pas d'open-redirect
        \Amoura\Core\Response::redirect($path);
    });

    // ── Authentification (invités uniquement) ───────────────────────────
    $r->group(['middleware' => [RedirectIfAuth::class]], function (Router $r) {
        $r->get('/register', 'Amoura\Controllers\AuthController@showRegister');
        $r->get('/login', 'Amoura\Controllers\AuthController@showLogin');
        $r->get('/forgot', 'Amoura\Controllers\AuthController@showForgot');
        $r->get('/verify', 'Amoura\Controllers\AuthController@showVerify');
    });
    $r->group(['middleware' => [VerifyCsrf::class]], function (Router $r) {
        $r->post('/register', 'Amoura\Controllers\AuthController@register');
        $r->post('/login', 'Amoura\Controllers\AuthController@login');
        $r->post('/verify', 'Amoura\Controllers\AuthController@verifyOtp');
        $r->post('/verify/resend', 'Amoura\Controllers\AuthController@resendOtp');
        $r->post('/forgot', 'Amoura\Controllers\AuthController@sendReset');
        $r->post('/reset', 'Amoura\Controllers\AuthController@resetPassword');
        $r->post('/logout', 'Amoura\Controllers\AuthController@logout');
    });

    // ── Espace membre (authentifié) ─────────────────────────────────────
    $auth = [Authenticate::class];
    $authCsrf = [Authenticate::class, VerifyCsrf::class];

    $r->get('/app', 'Amoura\Controllers\DiscoverController@index', $auth);
    $r->get('/api/ws-ticket', 'Amoura\Controllers\Api\RealtimeController@ticket', $auth);

    // Découverte & matching
    $r->get('/discover', 'Amoura\Controllers\DiscoverController@index', $auth);
    $r->get('/api/discover', 'Amoura\Controllers\DiscoverController@feed', $auth);
    $r->post('/api/swipe', 'Amoura\Controllers\DiscoverController@swipe', $authCsrf);
    $r->get('/likes', 'Amoura\Controllers\DiscoverController@admirers', $auth);
    $r->get('/visitors', 'Amoura\Controllers\ProfileController@visitors', $auth);

    // Notifications Web Push
    $r->get('/api/push/key', 'Amoura\Controllers\Api\PushController@publicKey', $auth);
    $r->post('/api/push/subscribe', 'Amoura\Controllers\Api\PushController@subscribe', $authCsrf);
    $r->post('/api/push/unsubscribe', 'Amoura\Controllers\Api\PushController@unsubscribe', $authCsrf);
    $r->get('/matches', 'Amoura\Controllers\MatchController@index', $auth);
    $r->post('/matches/{id}/unmatch', 'Amoura\Controllers\MatchController@unmatch', $authCsrf);

    // Profils
    $r->get('/profile', 'Amoura\Controllers\ProfileController@me', $auth);
    $r->get('/profile/edit', 'Amoura\Controllers\ProfileController@edit', $auth);
    $r->post('/profile', 'Amoura\Controllers\ProfileController@update', $authCsrf);
    $r->post('/profile/photos', 'Amoura\Controllers\ProfileController@uploadPhoto', $authCsrf);
    $r->post('/profile/photos/{id}/primary', 'Amoura\Controllers\ProfileController@setPrimaryPhoto', $authCsrf);
    $r->delete('/profile/photos/{id}', 'Amoura\Controllers\ProfileController@deletePhoto', $authCsrf);
    $r->post('/profile/privacy', 'Amoura\Controllers\ProfileController@updatePrivacy', $authCsrf);
    $r->post('/profile/verify', 'Amoura\Controllers\ProfileController@requestVerification', $authCsrf);
    $r->get('/u/{id}', 'Amoura\Controllers\ProfileController@show', $auth);
    $r->post('/u/{id}/block', 'Amoura\Controllers\ProfileController@block', $authCsrf);
    $r->post('/report', 'Amoura\Controllers\ProfileController@report', $authCsrf);

    // Messagerie
    $r->get('/messages', 'Amoura\Controllers\MessageController@index', $auth);
    $r->get('/messages/{id}', 'Amoura\Controllers\MessageController@thread', $auth);
    $r->get('/api/conversations/{id}/messages', 'Amoura\Controllers\MessageController@history', $auth);
    $r->post('/api/conversations/{id}/messages', 'Amoura\Controllers\MessageController@send', $authCsrf);
    $r->post('/api/conversations/{id}/read', 'Amoura\Controllers\MessageController@markRead', $authCsrf);
    $r->post('/api/conversations/{id}/voice', 'Amoura\Controllers\MessageController@sendVoice', $authCsrf);
    $r->post('/api/conversations/{id}/image', 'Amoura\Controllers\MessageController@sendImage', $authCsrf);
    $r->post('/api/messages/{id}/react', 'Amoura\Controllers\MessageController@react', $authCsrf);
    $r->delete('/api/messages/{id}', 'Amoura\Controllers\MessageController@delete', $authCsrf);

    // Appels (métadonnées ; le média est P2P via WebRTC/WebSocket)
    $r->get('/calls', 'Amoura\Controllers\CallController@history', $auth);
    $r->post('/api/calls', 'Amoura\Controllers\CallController@start', $authCsrf);
    $r->post('/api/calls/{id}/status', 'Amoura\Controllers\CallController@updateStatus', $authCsrf);
    $r->get('/api/webrtc/config', 'Amoura\Controllers\CallController@iceConfig', $auth);

    // Social : statuts & mur
    $r->get('/feed', 'Amoura\Controllers\PostController@index', $auth);
    $r->get('/api/feed', 'Amoura\Controllers\PostController@feed', $auth);
    $r->post('/api/posts', 'Amoura\Controllers\PostController@create', $authCsrf);
    $r->post('/api/posts/{id}/like', 'Amoura\Controllers\PostController@like', $authCsrf);
    $r->get('/api/posts/{id}/comments', 'Amoura\Controllers\PostController@comments', $auth);
    $r->post('/api/posts/{id}/comments', 'Amoura\Controllers\PostController@comment', $authCsrf);
    $r->delete('/api/posts/{id}', 'Amoura\Controllers\PostController@delete', $authCsrf);
    $r->get('/api/stories', 'Amoura\Controllers\StoryController@feed', $auth);
    $r->post('/api/stories', 'Amoura\Controllers\StoryController@create', $authCsrf);
    $r->post('/api/stories/{id}/view', 'Amoura\Controllers\StoryController@view', $authCsrf);

    // Notifications
    $r->get('/notifications', 'Amoura\Controllers\NotificationController@index', $auth);
    $r->get('/api/notifications', 'Amoura\Controllers\NotificationController@list', $auth);
    $r->post('/api/notifications/read', 'Amoura\Controllers\NotificationController@markRead', $authCsrf);

    // Abonnements & paiements
    $r->get('/premium', 'Amoura\Controllers\SubscriptionController@plans', $auth);
    $r->post('/premium/subscribe', 'Amoura\Controllers\SubscriptionController@subscribe', $authCsrf);
    $r->get('/premium/return', 'Amoura\Controllers\SubscriptionController@paymentReturn', $auth);
    $r->post('/premium/cancel', 'Amoura\Controllers\SubscriptionController@cancel', $authCsrf);
    // Webhooks (pas de CSRF : source externe ; vérifiés par signature/re-check serveur)
    $r->post('/webhooks/{gateway}', 'Amoura\Controllers\WebhookController@handle');

    // RGPD
    $r->get('/settings/data/export', 'Amoura\Controllers\ProfileController@exportData', $auth);
    $r->post('/settings/data/delete', 'Amoura\Controllers\ProfileController@deleteAccount', $authCsrf);

    // ── Espace administrateur / CMS (staff) ─────────────────────────────
    $staff = [RequireStaff::class];
    $staffCsrf = [RequireStaff::class, VerifyCsrf::class];
    $r->group(['prefix' => '/admin'], function (Router $r) use ($staff, $staffCsrf) {
        $r->get('', 'Amoura\Controllers\Admin\DashboardController@index', $staff);
        $r->get('/', 'Amoura\Controllers\Admin\DashboardController@index', $staff);

        $r->get('/members', 'Amoura\Controllers\Admin\MemberController@index', $staff);
        $r->get('/members/{id}', 'Amoura\Controllers\Admin\MemberController@show', $staff);
        $r->post('/members/{id}/status', 'Amoura\Controllers\Admin\MemberController@setStatus', $staffCsrf);
        $r->post('/members/{id}/verify', 'Amoura\Controllers\Admin\MemberController@verify', $staffCsrf);

        $r->get('/moderation', 'Amoura\Controllers\Admin\ModerationController@index', $staff);
        $r->post('/moderation/reports/{id}', 'Amoura\Controllers\Admin\ModerationController@resolve', $staffCsrf);
        $r->post('/moderation/photos/{id}', 'Amoura\Controllers\Admin\ModerationController@photo', $staffCsrf);

        $r->get('/billing', 'Amoura\Controllers\Admin\BillingController@index', $staff);
        $r->post('/billing/plans/{id}', 'Amoura\Controllers\Admin\BillingController@savePlan', $staffCsrf);
        $r->post('/billing/transactions/{id}/refund', 'Amoura\Controllers\Admin\BillingController@refund', $staffCsrf);

        $r->get('/settings', 'Amoura\Controllers\Admin\SettingsController@index', $staff);
        $r->post('/settings', 'Amoura\Controllers\Admin\SettingsController@update', $staffCsrf);
        $r->get('/pages', 'Amoura\Controllers\Admin\SettingsController@pages', $staff);
        $r->post('/pages', 'Amoura\Controllers\Admin\SettingsController@savePage', $staffCsrf);

        $r->get('/roles', 'Amoura\Controllers\Admin\RoleController@index', $staff);
        $r->post('/roles/{id}', 'Amoura\Controllers\Admin\RoleController@update', $staffCsrf);

        $r->get('/audit', 'Amoura\Controllers\Admin\AuditController@index', $staff);
        $r->post('/broadcast', 'Amoura\Controllers\Admin\DashboardController@broadcast', $staffCsrf);
    });
};

<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Security\Auth;
use Amoura\Core\Security\RateLimiter;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ApiToken;
use Amoura\Models\User;

/**
 * Authentification de l'API mobile : échange identifiants → jeton porteur.
 * Même politique de sécurité que le web (anti-énumération à temps constant,
 * limitation de débit par IP et par email, comptes suspendus/non vérifiés
 * rejetés), mais sans session : la réponse porte un jeton opaque révocable.
 */
final class AuthController extends ApiController
{
    /** Durée de vie par défaut d'un jeton mobile (30 jours). */
    private const TOKEN_TTL = 2592000;

    public function login(Request $request): void
    {
        $email = Sanitizer::email((string) $request->input('email'));
        $password = (string) $request->input('password');

        // Limitation par IP + par email (freine le bourrage d'identifiants).
        $max = Env::int('RATE_LIMIT_LOGIN', 5);
        if (!RateLimiter::attempt('api_login_ip:' . $request->ip(), $max * 4, 60)
            || ($email && !RateLimiter::attempt('api_login:' . $email, $max, 60))) {
            Response::error('Trop de tentatives. Réessayez dans une minute.', 429);
        }

        $userModel = new User();
        $user = $email ? $userModel->byEmail($email) : null;

        // Comparaison à temps constant même si l'utilisateur n'existe pas.
        $hash = $user['password_hash']
            ?? '$argon2id$v=19$m=65536,t=4,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        if (!$user || !Auth::verify($password, $hash)) {
            Response::error('Identifiants incorrects.', 401);
        }
        if (in_array($user['status'], ['banned', 'suspended', 'deleted'], true)) {
            Response::error('Ce compte est indisponible.', 403);
        }
        if ($user['status'] === 'pending' && ($user['email_verified_at'] ?? null) === null) {
            Response::error('Vérifiez d\'abord votre adresse email.', 403, ['code' => 'email_unverified']);
        }
        // Le 2FA reste géré par le tunnel web ; l'API n'émet pas de jeton en
        // contournant un second facteur activé.
        if ((int) ($user['totp_enabled'] ?? 0) === 1) {
            Response::error('Ce compte utilise la double authentification ; connectez-vous via le web.', 403,
                ['code' => 'totp_required']);
        }

        RateLimiter::clear('api_login:' . $email);

        $device = mb_substr((string) $request->input('device_name', $request->userAgent() ?: 'mobile'), 0, 100);
        $issued = (new ApiToken())->issue((int) $user['id'], $device, ['*'], self::TOKEN_TTL);

        // Réponse cohérente avec /me : profil enrichi de son rôle.
        $enriched = $userModel->withRole((int) $user['id']) ?? $user;

        Response::json([
            'ok'         => true,
            'token'      => $issued['token'],
            'token_type' => 'Bearer',
            'expires_at' => $issued['expires_at'],
            'user'       => $this->publicUser($enriched),
        ], 201);
    }

    /** Révoque le jeton courant (déconnexion de l'appareil). */
    public function logout(Request $request): void
    {
        $token = Auth::apiToken();
        if ($token !== null) {
            (new ApiToken())->revoke((int) $token['id'], (int) $token['user_id']);
        }
        Response::ok(['revoked' => true]);
    }
}

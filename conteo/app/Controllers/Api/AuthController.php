<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Helpers\Auth;
use App\Helpers\RateLimit;
use App\Helpers\Sanitize;
use App\Models\User;
use App\Services\SmsService;

final class AuthController extends Controller
{
    public function __construct(
        private User $users = new User(),
        private SmsService $sms = new SmsService(),
    ) {
    }

    /** POST /api/v1/auth/register */
    public function register(Request $request): void
    {
        $this->throttle($request);

        $v = new Validator($request->all(), [
            'phone'        => 'required|phone',
            'password'     => 'required|min:6|max:72',
            'display_name' => 'required|string|min:2|max:100',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $phone = Sanitize::phone((string) $request->input('phone'));
        if ($this->users->findByPhone($phone) !== null) {
            Response::error('Ce numéro est déjà enregistré.', 409);
            return;
        }

        $code = SmsService::generateCode();
        $userId = $this->users->insert([
            'phone'          => $phone,
            'password_hash'  => Auth::hashPassword((string) $request->input('password')),
            'display_name'   => Sanitize::text($request->input('display_name'), 100),
            'phone_verified' => 0,
            'otp_code'       => $code,
            'otp_expires_at' => (new \DateTimeImmutable('+10 minutes'))->format('Y-m-d H:i:s'),
        ]);

        $this->sms->sendOtp($phone, $code);

        Response::ok(['user_id' => $userId, 'otp_required' => true], 201);
    }

    /** POST /api/v1/auth/verify-otp */
    public function verifyOtp(Request $request): void
    {
        $this->throttle($request);

        $v = new Validator($request->all(), [
            'phone' => 'required|phone',
            'code'  => 'required|digits:6',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $phone = Sanitize::phone((string) $request->input('phone'));
        $user = $this->users->findByPhone($phone);

        if (
            $user === null
            || $user['otp_code'] === null
            || !hash_equals((string) $user['otp_code'], (string) $request->input('code'))
            || strtotime((string) $user['otp_expires_at']) < time()
        ) {
            Response::error('Code invalide ou expiré.', 401);
            return;
        }

        $this->users->update((int) $user['id'], [
            'phone_verified' => 1,
            'otp_code'       => null,
            'otp_expires_at' => null,
        ]);

        $token = Auth::issueToken((int) $user['id'], $request->header('User-Agent'));
        Response::ok(['token' => $token, 'user' => $this->publicUser($user)]);
    }

    /** POST /api/v1/auth/login */
    public function login(Request $request): void
    {
        $this->throttle($request);

        $v = new Validator($request->all(), [
            'phone'    => 'required|phone',
            'password' => 'required|string',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $phone = Sanitize::phone((string) $request->input('phone'));
        $user = $this->users->findByPhone($phone);

        // Message générique pour ne pas révéler l'existence du compte.
        if ($user === null || !Auth::verifyPassword((string) $request->input('password'), (string) $user['password_hash'])) {
            Response::error('Identifiants incorrects.', 401);
            return;
        }
        if ($user['status'] !== 'active') {
            Response::error('Compte indisponible.', 403);
            return;
        }
        if ((int) $user['phone_verified'] !== 1) {
            Response::error('Numéro non vérifié.', 403, ['phone' => ['Vérifiez votre numéro.']]);
            return;
        }

        $token = Auth::issueToken((int) $user['id'], $request->header('User-Agent'));
        Response::ok(['token' => $token, 'user' => $this->publicUser($user)]);
    }

    /** POST /api/v1/auth/logout (auth) */
    public function logout(Request $request): void
    {
        $token = $request->bearerToken();
        if ($token) {
            Auth::revoke($token);
        }
        Response::ok(['logged_out' => true]);
    }

    /** GET /api/v1/auth/me (auth) */
    public function me(Request $request): void
    {
        Response::ok(['user' => $this->publicUser($this->user() ?? [])]);
    }

    /** DELETE /api/v1/auth/me (auth) — droit à la suppression (RGPD/COPPA) */
    public function deleteAccount(Request $request): void
    {
        // La suppression cascade sur profils, progression, paiements (FK ON DELETE CASCADE).
        $this->users->delete($this->userId());
        Response::ok(['deleted' => true]);
    }

    /** @param array<string,mixed> $user */
    private function publicUser(array $user): array
    {
        return [
            'id'             => (int) ($user['id'] ?? 0),
            'phone'          => $user['phone'] ?? null,
            'display_name'   => $user['display_name'] ?? null,
            'phone_verified' => (bool) ($user['phone_verified'] ?? false),
            'is_admin'       => (bool) ($user['is_admin'] ?? false),
        ];
    }

    private function throttle(Request $request): void
    {
        $config = require dirname(__DIR__, 3) . '/config/config.php';
        $key = 'auth:' . $request->ip();
        if (RateLimit::tooMany($key, $config['rate']['auth_max'], $config['rate']['auth_window'])) {
            Response::error('Trop de tentatives. Réessayez plus tard.', 429);
            exit;
        }
    }
}

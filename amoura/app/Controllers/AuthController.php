<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Auth;
use Amoura\Core\Security\RateLimiter;
use Amoura\Core\Security\Sanitizer;
use Amoura\Core\Security\Validator;
use Amoura\Models\ActivityLog;
use Amoura\Models\Profile;
use Amoura\Models\Setting;
use Amoura\Models\User;
use Amoura\Services\Mailer;
use Amoura\Services\OtpService;

final class AuthController extends Controller
{
    public function showRegister(Request $r): void { $this->view('auth/register', [], 'layouts/auth'); }
    public function showLogin(Request $r): void    { $this->view('auth/login', [], 'layouts/auth'); }
    public function showForgot(Request $r): void   { $this->view('auth/forgot', [], 'layouts/auth'); }
    public function showVerify(Request $r): void
    {
        $this->view('auth/verify', ['destination' => Session::get('pending_verification')], 'layouts/auth');
    }

    // ── Inscription ────────────────────────────────────────────────────
    public function register(Request $request): void
    {
        $settings = new Setting();
        if (!$settings->get('registration_open', true)) {
            Session::flash('error', 'Les inscriptions sont actuellement fermées.');
            $this->redirect('/register');
        }

        $data = $request->all();
        $minAge = (int) $settings->get('min_age', 18);

        $v = (new Validator($data))
            ->require('display_name')->min('display_name', 2)->max('display_name', 100)
            ->require('email')->email('email')
            ->require('password')->strongPassword('password')
            ->matches('password', 'password_confirm')
            ->require('birthdate')->minAge('birthdate', $minAge)
            ->require('gender')->in('gender', ['male', 'female', 'nonbinary', 'other']);

        if (empty($data['accept_terms'])) {
            Session::flash('error', 'Vous devez accepter les conditions et confirmer avoir 18 ans ou plus.');
            $this->redirect('/register');
        }
        if ($v->fails()) {
            Session::flash('error', $v->firstError());
            $this->redirect('/register');
        }

        $email = Sanitizer::email($data['email']);
        $userModel = new User();
        if ($email === null || $userModel->byEmail($email)) {
            Session::flash('error', 'Cet email est invalide ou déjà utilisé.');
            $this->redirect('/register');
        }

        // Création du compte (statut « pending » jusqu'à vérification email).
        $userId = $userModel->create([
            'email' => $email,
            'password_hash' => Auth::hash((string) $data['password']),
            'display_name' => Sanitizer::text($data['display_name'], 100),
            'birthdate' => $data['birthdate'],
            'gender' => $data['gender'],
            'status' => 'pending',
            'gdpr_consent_at' => date('Y-m-d H:i:s'),
        ]);
        (new Profile())->ensureExists($userId);

        // Émission de l'OTP de vérification email.
        $code = OtpService::issue($userId, 'email', 'verify', $email);
        Mailer::send($email, 'Vérifiez votre compte Amoura',
            Mailer::template('Votre code de vérification', "<p>Votre code : <strong style=\"font-size:22px\">{$code}</strong></p><p>Il expire dans 10 minutes.</p>"));

        (new ActivityLog())->record($userId, 'user.register', 'user', $userId, [], $request->ip());

        Session::put('pending_verification', $email);
        Session::put('pending_user', $userId);
        Session::flash('success', 'Compte créé ! Saisissez le code envoyé par email.');
        $this->redirect('/verify');
    }

    // ── Vérification OTP ───────────────────────────────────────────────
    public function verifyOtp(Request $request): void
    {
        $email = (string) Session::get('pending_verification');
        $code = Sanitizer::text((string) $request->input('code'), 6);
        if ($email === '') {
            $this->redirect('/login');
        }
        if (!RateLimiter::attempt('otp:' . $email, 6, 300)) {
            Session::flash('error', 'Trop de tentatives. Réessayez plus tard.');
            $this->redirect('/verify');
        }

        $result = OtpService::verify($email, 'verify', $code);
        if (!$result['ok']) {
            Session::flash('error', $result['error']);
            $this->redirect('/verify');
        }

        $userModel = new User();
        $user = $userModel->byEmail($email);
        if ($user) {
            $userModel->update((int) $user['id'], [
                'email_verified_at' => date('Y-m-d H:i:s'),
                'status' => 'active',
            ]);
            Auth::login((int) $user['id']);
        }
        Session::forget('pending_verification');
        Session::forget('pending_user');
        Session::flash('success', 'Email vérifié. Bienvenue sur Amoura !');
        $this->redirect('/profile/edit');
    }

    public function resendOtp(Request $request): void
    {
        $email = (string) Session::get('pending_verification');
        if ($email === '' || !RateLimiter::attempt('otp_resend:' . $email, 3, 300)) {
            $this->json(['ok' => false, 'error' => 'Patientez avant de redemander un code.'], 429);
        }
        $user = (new User())->byEmail($email);
        $code = OtpService::issue($user['id'] ?? null, 'email', 'verify', $email);
        Mailer::send($email, 'Votre nouveau code Amoura',
            Mailer::template('Nouveau code', "<p>Code : <strong>{$code}</strong></p>"));
        $this->json(['ok' => true]);
    }

    // ── Connexion ──────────────────────────────────────────────────────
    public function login(Request $request): void
    {
        $email = Sanitizer::email((string) $request->input('email'));
        $password = (string) $request->input('password');

        // Limitation par IP + par email pour freiner le bourrage d'identifiants.
        $ipBucket = 'login_ip:' . $request->ip();
        $max = Env::int('RATE_LIMIT_LOGIN', 5);
        if (!RateLimiter::attempt($ipBucket, $max * 4, 60) ||
            ($email && !RateLimiter::attempt('login:' . $email, $max, 60))) {
            Session::flash('error', 'Trop de tentatives. Réessayez dans une minute.');
            $this->redirect('/login');
        }

        $userModel = new User();
        $user = $email ? $userModel->byEmail($email) : null;

        // Comparaison à temps constant même si l'utilisateur n'existe pas (anti-énumération).
        $hash = $user['password_hash'] ?? '$argon2id$v=19$m=65536,t=4,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        if (!$user || !Auth::verify($password, $hash)) {
            Session::flash('error', 'Identifiants incorrects.');
            $this->redirect('/login');
        }

        if (in_array($user['status'], ['banned', 'suspended'], true)) {
            Session::flash('error', 'Ce compte est suspendu. Contactez le support.');
            $this->redirect('/login');
        }
        if ($user['status'] === 'pending' && $user['email_verified_at'] === null) {
            Session::put('pending_verification', $user['email']);
            Session::flash('error', 'Vérifiez d\'abord votre email.');
            $this->redirect('/verify');
        }

        // Ré-hachage transparent si les paramètres Argon2 ont évolué.
        if (Auth::needsRehash($user['password_hash'])) {
            $userModel->update((int) $user['id'], ['password_hash' => Auth::hash($password)]);
        }

        RateLimiter::clear('login:' . $email);

        // Deuxième facteur (TOTP) activé : mot de passe validé, on exige le code.
        if ((int) ($user['totp_enabled'] ?? 0) === 1) {
            Session::put('pending_2fa_user', (int) $user['id']);
            $this->redirect('/2fa');
        }

        Auth::login((int) $user['id']);
        (new ActivityLog())->record((int) $user['id'], 'user.login', 'user', (int) $user['id'], [], $request->ip());

        $intended = Session::get('intended_url', '/app');
        Session::forget('intended_url');
        $this->redirect(is_string($intended) ? $intended : '/app');
    }

    // ── Deuxième facteur (2FA / TOTP) ──────────────────────────────────
    public function showTwoFactor(Request $request): void
    {
        if (!Session::has('pending_2fa_user')) {
            $this->redirect('/login');
        }
        $this->view('auth/twofactor', [], 'layouts/auth');
    }

    public function verifyTwoFactor(Request $request): void
    {
        $userId = (int) Session::get('pending_2fa_user', 0);
        if ($userId === 0) {
            $this->redirect('/login');
        }
        if (!RateLimiter::attempt('2fa:' . $userId, 6, 300)) {
            Session::flash('error', 'Trop de tentatives. Réessayez plus tard.');
            $this->redirect('/2fa');
        }

        $user = (new User())->find($userId);
        $code = (string) $request->input('code');

        if (!$user || (int) $user['totp_enabled'] !== 1
            || !\Amoura\Core\Security\Totp::verify((string) $user['totp_secret'], $code)) {
            Session::flash('error', 'Code de vérification invalide.');
            $this->redirect('/2fa');
        }

        Session::forget('pending_2fa_user');
        Auth::login($userId);
        (new ActivityLog())->record($userId, 'user.login_2fa', 'user', $userId, [], $request->ip());

        $intended = Session::get('intended_url', '/app');
        Session::forget('intended_url');
        $this->redirect(is_string($intended) ? $intended : '/app');
    }

    public function logout(Request $request): void
    {
        Auth::logout();
        Session::flush();
        $this->redirect('/');
    }

    // ── Mot de passe oublié ────────────────────────────────────────────
    public function sendReset(Request $request): void
    {
        $email = Sanitizer::email((string) $request->input('email'));
        if ($email && RateLimiter::attempt('reset:' . $email, 3, 600)) {
            $user = (new User())->byEmail($email);
            if ($user) {
                $code = OtpService::issue((int) $user['id'], 'email', 'reset', $email);
                Mailer::send($email, 'Réinitialisation de mot de passe',
                    Mailer::template('Code de réinitialisation', "<p>Code : <strong>{$code}</strong></p><p>Valable 10 minutes.</p>"));
            }
        }
        // Message générique : ne révèle pas si l'email existe.
        Session::put('pending_verification', $email);
        Session::flash('success', 'Si un compte existe, un code a été envoyé.');
        $this->redirect('/forgot?step=reset');
    }

    public function resetPassword(Request $request): void
    {
        $email = (string) Session::get('pending_verification');
        $code = Sanitizer::text((string) $request->input('code'), 6);
        $password = (string) $request->input('password');

        $v = (new Validator($request->all()))
            ->require('password')->strongPassword('password')->matches('password', 'password_confirm');
        if ($v->fails()) {
            Session::flash('error', $v->firstError());
            $this->redirect('/forgot?step=reset');
        }

        $result = OtpService::verify($email, 'reset', $code);
        if (!$result['ok']) {
            Session::flash('error', $result['error']);
            $this->redirect('/forgot?step=reset');
        }

        $userModel = new User();
        $user = $userModel->byEmail($email);
        if ($user) {
            $userModel->update((int) $user['id'], ['password_hash' => Auth::hash($password)]);
            (new ActivityLog())->record((int) $user['id'], 'user.password_reset', 'user', (int) $user['id'], [], $request->ip());
        }
        Session::forget('pending_verification');
        Session::flash('success', 'Mot de passe mis à jour. Connectez-vous.');
        $this->redirect('/login');
    }
}

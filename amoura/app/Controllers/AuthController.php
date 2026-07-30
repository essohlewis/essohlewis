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
use Amoura\Services\WhatsApp\WhatsAppService;

final class AuthController extends Controller
{
    public function showRegister(Request $r): void
    {
        $ref = \Amoura\Core\Security\Sanitizer::text((string) $r->query('ref', ''), 16);
        $this->view('auth/register', ['ref' => $ref], 'layouts/auth');
    }
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
            ->require('phone')->phone('phone')
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
        $phone = Sanitizer::text((string) ($data['phone'] ?? ''), 30);
        $userModel = new User();
        if ($email === null || $userModel->byEmail($email)) {
            Session::flash('error', 'Cet email est invalide ou déjà utilisé.');
            $this->redirect('/register');
        }
        if ($userModel->byPhone($phone)) {
            Session::flash('error', 'Ce numéro WhatsApp est déjà utilisé.');
            $this->redirect('/register');
        }

        // Création du compte (statut « pending » jusqu'à vérification).
        // Le rôle est résolu dynamiquement (jamais un id codé en dur) : l'inscription
        // fonctionne même si la table `roles` a été partiellement initialisée.
        $userId = $userModel->create([
            'role_id' => (new \Amoura\Models\Role())->memberRoleId(),
            'email' => $email,
            'phone' => $phone,
            'password_hash' => Auth::hash((string) $data['password']),
            'display_name' => Sanitizer::text($data['display_name'], 100),
            'birthdate' => $data['birthdate'],
            'gender' => $data['gender'],
            'status' => 'pending',
            'gdpr_consent_at' => date('Y-m-d H:i:s'),
        ]);
        (new Profile())->ensureExists($userId);

        // Journalise les consentements RGPD (preuve : finalité + version + IP).
        $consent = new \Amoura\Models\Consent();
        $policyVersion = (string) $settings->get('policy_version', '1.0');
        $consent->record($userId, 'privacy_policy', true, $policyVersion, $request->ip());
        $consent->record($userId, 'terms', true, $policyVersion, $request->ip());
        // Marketing : opt-in explicite et facultatif (case décochée par défaut).
        $consent->record($userId, 'marketing', !empty($data['accept_marketing']), $policyVersion, $request->ip());

        // Parrainage : dote le nouveau membre d'un code et enregistre son parrain
        // éventuel (récompense accordée après vérification du compte).
        $referral = new \Amoura\Models\Referral();
        $referral->codeFor($userId);
        $refCode = trim((string) ($data['ref'] ?? ''));
        if ($refCode !== '') {
            $referral->record($refCode, $userId);
        }

        // Émission de l'OTP puis envoi du code par WhatsApp (l'OTP reste indexé
        // sur l'email pour la vérification ; seul le canal de remise change).
        $code = OtpService::issue($userId, 'phone', 'verify', $email);
        WhatsAppService::sendOtp($phone, $code);

        (new ActivityLog())->record($userId, 'user.register', 'user', $userId, [], $request->ip());

        Session::put('pending_verification', $email);
        Session::put('pending_user', $userId);
        // En développement, aucun message réel n'est envoyé (pilote « log ») : on
        // affiche le code pour permettre la vérification sans WhatsApp configuré.
        Session::flash('success', $this->otpShownInDev()
            ? "Compte créé ! Mode développement : votre code de vérification est {$code} (aucun message réel envoyé ; voir aussi storage/logs/whatsapp.log)."
            : 'Compte créé ! Saisissez le code reçu sur WhatsApp.');
        $this->redirect('/verify');
    }

    /**
     * Vrai lorsqu'aucun message réel ne quitte le serveur (mode dev : APP_DEBUG +
     * pilote WhatsApp « log »). Dans ce cas on peut afficher le code OTP en clair
     * pour débloquer la vérification locale, sans jamais le faire en production.
     */
    private function otpShownInDev(): bool
    {
        return Env::bool('APP_DEBUG') && WhatsAppService::isLoggedOnly();
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
            // Parrainage : récompense le parrain (et le filleul) à la qualification.
            $referrerId = (new \Amoura\Models\Referral())->qualify((int) $user['id']);
            if ($referrerId !== null) {
                (new \Amoura\Models\Notification())->push($referrerId, 'system', null, [
                    'message' => 'Votre filleul a rejoint Amoura : ' . \Amoura\Models\Referral::REFERRER_REWARD
                        . ' Super Likes vous ont été offerts 🎁',
                ]);
            }
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
        $code = OtpService::issue($user['id'] ?? null, 'phone', 'verify', $email);
        $phone = (string) ($user['phone'] ?? '');
        if ($phone !== '') {
            WhatsAppService::sendOtp($phone, $code);
        }
        // En mode dev (message non réellement envoyé), on renvoie le code pour l'afficher.
        $this->json(['ok' => true] + ($this->otpShownInDev() ? ['dev_code' => $code] : []));
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
        \Amoura\Services\Security\DeviceMonitor::track((int) $user['id'], $request->userAgent(), $request->ip());

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
        \Amoura\Services\Security\DeviceMonitor::track($userId, $request->userAgent(), $request->ip());

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
        $devCode = null;
        if ($email && RateLimiter::attempt('reset:' . $email, 3, 600)) {
            $user = (new User())->byEmail($email);
            if ($user) {
                $code = OtpService::issue((int) $user['id'], 'phone', 'reset', $email);
                $phone = (string) ($user['phone'] ?? '');
                if ($phone !== '') {
                    // Canal principal : WhatsApp (comme à l'inscription).
                    WhatsAppService::sendOtp($phone, $code);
                } else {
                    // Repli email pour les comptes sans numéro enregistré.
                    Mailer::send($email, 'Réinitialisation de mot de passe',
                        Mailer::template('Code de réinitialisation', "<p>Code : <strong>{$code}</strong></p><p>Valable 10 minutes.</p>"));
                }
                if ($this->otpShownInDev()) {
                    $devCode = $code;
                }
            }
        }
        // Message générique : ne révèle pas si l'email existe (sauf code dev).
        Session::put('pending_verification', $email);
        Session::flash('success', $devCode !== null
            ? "Mode développement : votre code de réinitialisation est {$devCode} (aucun message réel envoyé)."
            : 'Si un compte existe, un code a été envoyé sur WhatsApp.');
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

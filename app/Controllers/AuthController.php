<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Csrf;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Session;
use Transouscris\Core\Validator;
use Transouscris\Models\User;
use Transouscris\Services\AuditLogger;
use Transouscris\Services\OperatorDetector;
use Transouscris\Services\OtpService;

/**
 * Inscription / connexion par téléphone + OTP SMS.
 */
final class AuthController extends Controller
{
    public function __construct(
        private OtpService $otp = new OtpService(),
        private OperatorDetector $detector = new OperatorDetector(),
        private AuditLogger $audit = new AuditLogger()
    ) {}

    public function showLogin(Request $request): Response
    {
        if (Session::userId() !== null) {
            return $this->redirect('/dashboard');
        }
        return $this->view('auth.login', ['title' => 'Connexion']);
    }

    /** Étape 1 : demande d'OTP pour un numéro. */
    public function requestOtp(Request $request): Response
    {
        $data  = Validator::make($request->only(['phone']))
            ->validate(['phone' => 'required|phone_ci']);

        $msisdn = $this->detector->normalize($data['phone']);
        if ($msisdn === null) {
            return $this->json(['error' => 'Numéro invalide.'], 422);
        }
        // Stocke E.164 sans + comme identifiant canonique.
        $canonical = $this->detector->toE164($msisdn);

        if (!$this->otp->send($canonical, 'login')) {
            return $this->json(['error' => 'Trop de demandes de code. Réessayez plus tard.'], 429);
        }

        Session::set('otp_phone', $canonical);

        $response = ['ok' => true, 'message' => 'Code envoyé par SMS.'];
        // Mode développement uniquement : renvoie le code pour tester sans SMS réel.
        if (\Transouscris\Core\Config::get('app.debug') && $this->otp->debugCode !== null) {
            $response['dev_code'] = $this->otp->debugCode;
            $response['message']  = 'Mode dev : SMS non envoyé, code affiché ci-dessous.';
        }
        return $this->json($response);
    }

    /** Étape 2 : vérification de l'OTP et connexion (création de compte si besoin). */
    public function verifyOtp(Request $request): Response
    {
        $data = Validator::make($request->only(['phone', 'code', 'name']))->validate([
            'phone' => 'required|phone_ci',
            'code'  => 'required|regex:/^\d{6}$/',
        ]);

        $canonical = $this->detector->toE164($this->detector->normalize($data['phone']) ?? '');
        $sessionPhone = Session::get('otp_phone');
        if ($sessionPhone !== null && !hash_equals((string) $sessionPhone, $canonical)) {
            return $this->json(['error' => 'Numéro incohérent avec la demande de code.'], 422);
        }

        if (!$this->otp->verify($canonical, $data['code'], 'login')) {
            return $this->json(['error' => 'Code invalide ou expiré.'], 422);
        }

        $user = User::findByPhone($canonical) ?? User::create($canonical, $request->input('name'));
        if (!$user->phoneVerified) {
            $user->markPhoneVerified();
        }
        // Provisionne le portefeuille dès la première connexion.
        $user->wallet();

        Session::regenerate();
        Session::set('user_id', $user->id);
        Session::forget('otp_phone');
        Csrf::rotate();

        $this->audit->log('auth.login', 'user', $user->id, ['phone' => $canonical], $user->id);

        return $this->json(['ok' => true, 'redirect' => '/dashboard']);
    }

    public function logout(Request $request): Response
    {
        $uid = Session::userId();
        if ($uid) {
            $this->audit->log('auth.logout', 'user', $uid, [], $uid);
        }
        Session::destroy();
        return $this->redirect('/login');
    }
}

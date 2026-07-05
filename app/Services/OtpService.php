<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Config;
use Transouscris\Core\RateLimiter;
use Transouscris\Models\OtpCode;

/**
 * Génération et vérification des codes OTP.
 *
 * Sécurité :
 *   - Code à 6 chiffres, jamais stocké en clair (hash SHA-256 + APP_KEY salé).
 *   - Rate limiting par numéro (envoi) ET par tentative (vérification).
 *   - Comparaison en temps constant, invalidation après consommation ou
 *     dépassement du nombre de tentatives.
 */
final class OtpService
{
    /**
     * Dernier code généré, exposé UNIQUEMENT en mode développement
     * (APP_DEBUG=true) pour permettre les tests sans passerelle SMS.
     * Reste null en production.
     */
    public ?string $debugCode = null;

    public function __construct(private SmsService $sms = new SmsService()) {}

    /**
     * Émet un OTP et l'envoie par SMS. Retourne false si rate limité.
     */
    public function send(string $phone, string $purpose = 'login'): bool
    {
        $ttl        = (int) Config::get('security.otp_ttl', 300);
        $rlKey      = "otp:send:$purpose:$phone";

        // Max 3 envois par fenêtre de 10 min.
        if (!RateLimiter::attempt($rlKey, 3, 600)) {
            return false;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        OtpCode::issue($phone, $this->hash($phone, $code), $purpose, $ttl);

        $appName = Config::get('app.name', 'Transouscris');
        $this->sms->send($phone, "$appName : votre code de vérification est $code. Valable " . ($ttl / 60) . " min. Ne le partagez jamais.");

        // En développement seulement : on expose le code pour faciliter les tests.
        if (Config::get('app.debug')) {
            $this->debugCode = $code;
        }

        return true;
    }

    /**
     * Vérifie un code. Retourne true si valide (et consomme le code).
     */
    public function verify(string $phone, string $code, string $purpose = 'login'): bool
    {
        $maxAttempts = (int) Config::get('security.otp_max_attempts', 5);

        // Rate limit global des tentatives par numéro (anti brute-force).
        if (!RateLimiter::attempt("otp:verify:$purpose:$phone", $maxAttempts * 2, 600)) {
            return false;
        }

        $otp = OtpCode::activeFor($phone, $purpose);
        if ($otp === null) {
            return false;
        }

        if ($otp->attempts >= $maxAttempts) {
            $otp->consume(); // brûle le code après trop d'essais
            return false;
        }

        $otp->incrementAttempts();

        if (!hash_equals($otp->codeHash, $this->hash($phone, $code))) {
            return false;
        }

        $otp->consume();
        RateLimiter::clear("otp:verify:$purpose:$phone");
        return true;
    }

    private function hash(string $phone, string $code): string
    {
        $key = Config::get('app.key', '');
        return hash('sha256', $phone . ':' . $code . ':' . $key);
    }
}

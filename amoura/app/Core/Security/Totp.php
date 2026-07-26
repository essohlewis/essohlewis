<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

/**
 * TOTP — mots de passe à usage unique basés sur le temps (RFC 6238),
 * compatibles Google Authenticator / Authy / FreeOTP (Sprint +4 — 2FA).
 * Implémentation autonome (HMAC-SHA1, pas de dépendance).
 */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 (RFC 4648)
    private const PERIOD = 30;   // secondes
    private const DIGITS = 6;

    /** Génère un secret Base32 aléatoire (par défaut 20 octets = 32 caractères). */
    public static function generateSecret(int $bytes = 20): string
    {
        return self::base32Encode(random_bytes($bytes));
    }

    /** URI otpauth:// à encoder dans un QR code. */
    public static function provisioningUri(string $secret, string $account, string $issuer): string
    {
        $label = rawurlencode($issuer . ':' . $account);
        $params = http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::DIGITS,
            'period' => self::PERIOD,
        ]);
        return "otpauth://totp/{$label}?{$params}";
    }

    /** Code à 6 chiffres pour un secret à un instant donné (défaut : maintenant). */
    public static function codeAt(string $secret, ?int $timestamp = null): string
    {
        $counter = (int) floor(($timestamp ?? time()) / self::PERIOD);
        return self::hotp($secret, $counter);
    }

    /**
     * Vérifie un code en tolérant une dérive d'horloge de ±$window périodes.
     * Comparaison à temps constant.
     */
    public static function verify(string $secret, string $code, int $window = 1, ?int $timestamp = null): bool
    {
        $code = preg_replace('/\D/', '', $code) ?? '';
        if (strlen($code) !== self::DIGITS) {
            return false;
        }
        $counter = (int) floor(($timestamp ?? time()) / self::PERIOD);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::hotpFromCounter($secret, $counter + $i), $code)) {
                return true;
            }
        }
        return false;
    }

    private static function hotp(string $secret, int $counter): string
    {
        return self::hotpFromCounter($secret, $counter);
    }

    private static function hotpFromCounter(string $secret, int $counter): string
    {
        $key = self::base32Decode($secret);
        if ($key === '') {
            return str_repeat('0', self::DIGITS);
        }
        $binCounter = pack('N*', 0, $counter); // 64 bits big-endian
        $hash = hash_hmac('sha1', $binCounter, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $truncated = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );
        return str_pad((string) ($truncated % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    public static function base32Encode(string $data): string
    {
        if ($data === '') {
            return '';
        }
        $bits = '';
        foreach (str_split($data) as $char) {
            $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($bits, 5) as $chunk) {
            $output .= self::ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }
        return $output;
    }

    public static function base32Decode(string $b32): string
    {
        $b32 = strtoupper(preg_replace('/[^A-Z2-7]/', '', $b32) ?? '');
        if ($b32 === '') {
            return '';
        }
        $bits = '';
        foreach (str_split($b32) as $char) {
            $bits .= str_pad(decbin(strpos(self::ALPHABET, $char)), 5, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $output .= chr(bindec($byte));
            }
        }
        return $output;
    }
}

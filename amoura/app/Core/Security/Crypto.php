<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

use Amoura\Core\Env;

/**
 * Chiffrement symétrique authentifié au repos (Sprint +6).
 * Utilise libsodium (XSalsa20-Poly1305 via secretbox) ; la clé dérive d'APP_KEY.
 * Transparent : encrypt() préfixe « enc:1: », decrypt() renvoie tel quel un texte
 * non chiffré (rétro-compatibilité avec les données existantes).
 */
final class Crypto
{
    private const PREFIX = 'enc:1:';

    private static function key(): string
    {
        $appKey = (string) Env::get('APP_KEY', '');
        if ($appKey === '') {
            $appKey = 'insecure-dev-key-change-me';
        }
        // Dérive une clé de 32 octets adaptée à secretbox.
        return hash('sha256', 'amoura-msg|' . $appKey, true);
    }

    public static function isEncrypted(string $value): bool
    {
        return str_starts_with($value, self::PREFIX);
    }

    public static function encrypt(string $plaintext): string
    {
        if (!function_exists('sodium_crypto_secretbox')) {
            return $plaintext; // dégradation gracieuse si l'extension manque
        }
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = sodium_crypto_secretbox($plaintext, $nonce, self::key());
        return self::PREFIX . base64_encode($nonce . $cipher);
    }

    public static function decrypt(string $value): string
    {
        if (!self::isEncrypted($value) || !function_exists('sodium_crypto_secretbox_open')) {
            return $value; // texte clair (ancien) → renvoyé tel quel
        }
        $raw = base64_decode(substr($value, strlen(self::PREFIX)), true);
        if ($raw === false || strlen($raw) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return '';
        }
        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open($cipher, $nonce, self::key());
        return $plain === false ? '' : $plain;
    }
}

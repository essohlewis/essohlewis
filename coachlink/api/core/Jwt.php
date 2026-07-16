<?php
/* ==========================================================================
   core/Jwt.php — Génération / vérification de JSON Web Tokens (HS256),
   sans dépendance externe. Signature HMAC-SHA256.
   ========================================================================== */

class Jwt
{
    /** Encode un payload en JWT signé. */
    public static function encoder(array $payload): string
    {
        $secret = App::config('jwt_secret');
        $ttl    = App::config('jwt_ttl');

        $entete  = ['alg' => 'HS256', 'typ' => 'JWT'];
        $payload = array_merge([
            'iat' => time(),
            'exp' => time() + $ttl,
        ], $payload);

        $segEntete  = self::b64UrlEncode(json_encode($entete));
        $segPayload = self::b64UrlEncode(json_encode($payload));
        $signature  = self::signer($segEntete . '.' . $segPayload, $secret);

        return $segEntete . '.' . $segPayload . '.' . $signature;
    }

    /** Décode et vérifie un JWT. Retourne le payload ou null si invalide/expiré. */
    public static function decoder(string $jwt): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        [$segEntete, $segPayload, $signature] = $parts;

        $attendu = self::signer($segEntete . '.' . $segPayload, App::config('jwt_secret'));
        if (!hash_equals($attendu, $signature)) {
            return null; // signature invalide
        }

        $payload = json_decode(self::b64UrlDecode($segPayload), true);
        if (!is_array($payload)) {
            return null;
        }
        if (isset($payload['exp']) && time() >= $payload['exp']) {
            return null; // expiré
        }
        return $payload;
    }

    private static function signer(string $donnees, string $secret): string
    {
        return self::b64UrlEncode(hash_hmac('sha256', $donnees, $secret, true));
    }

    private static function b64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

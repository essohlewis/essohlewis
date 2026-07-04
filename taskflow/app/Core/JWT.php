<?php
namespace App\Core;

class JWT {
    // Generate a signed JWT token
    public static function encode($payload, $expirySeconds) {
        $secret = getenv('JWT_SECRET') ?: 'change_cette_valeur_en_production';
        
        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT'
        ];

        // Add expiration time to payload
        $payload['exp'] = time() + $expirySeconds;

        $base64UrlHeader = self::base64UrlEncode(json_encode($header));
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    // Decode and validate a JWT token. Returns payload or false if invalid/expired.
    public static function decode($token) {
        $secret = getenv('JWT_SECRET') ?: 'change_cette_valeur_en_production';
        
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;

        // Verify signature
        $signature = self::base64UrlDecode($base64UrlSignature);
        $expectedSignature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);

        if (!hash_equals($signature, $expectedSignature)) {
            return false; // Signature mismatch
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        if (!$payload) {
            return false; // Invalid JSON payload
        }

        // Verify expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return false; // Token expired
        }

        return $payload;
    }

    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data) {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }
}

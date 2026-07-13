<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Assainissement des entrées/sorties (anti-XSS).
 */
final class Sanitize
{
    /** Échappement HTML pour rendu en sortie côté serveur. */
    public static function html(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /** Nettoie une chaîne : trim + suppression des caractères de contrôle. */
    public static function text(mixed $value, int $maxLen = 500): string
    {
        $s = is_string($value) ? $value : (string) $value;
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
        $s = trim($s);
        return mb_substr($s, 0, $maxLen);
    }

    /** Normalise un numéro de téléphone au format E.164 approximatif. */
    public static function phone(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/[\s\-\.\(\)]/', '', $value) ?? '';
        return $value;
    }
}

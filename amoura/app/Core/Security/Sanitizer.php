<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

/**
 * Nettoyage des entrées / sorties (anti-XSS).
 */
final class Sanitizer
{
    /** Échappement HTML pour affichage dans une vue. */
    public static function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** Nettoie une chaîne de texte simple (trim + suppression des caractères de contrôle). */
    public static function text(?string $value, int $maxLength = 5000): string
    {
        $value = (string) $value;
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
        return mb_substr(trim($value), 0, $maxLength);
    }

    /**
     * Autorise un sous-ensemble sûr de HTML pour le contenu riche (bios, posts).
     * Approche « liste blanche » très restrictive.
     */
    public static function richText(?string $html, int $maxLength = 8000): string
    {
        $html = (string) $html;
        $allowed = '<p><br><b><strong><i><em><u><ul><ol><li><a><blockquote>';
        $clean = strip_tags($html, $allowed);
        // Neutralise les schémas d'URL dangereux dans les liens.
        $clean = preg_replace('/href\s*=\s*"(?!https?:|mailto:|\/)[^"]*"/i', 'href="#"', $clean) ?? $clean;
        $clean = preg_replace('/on\w+\s*=\s*"[^"]*"/i', '', $clean) ?? $clean;
        return mb_substr($clean, 0, $maxLength);
    }

    public static function email(?string $value): ?string
    {
        $value = trim((string) $value);
        $filtered = filter_var($value, FILTER_VALIDATE_EMAIL);
        return $filtered ?: null;
    }

    /** Normalise un numéro ouest-africain (préfixes 07/05/01) ou format E.164. */
    public static function phone(?string $value): ?string
    {
        $digits = preg_replace('/[^\d+]/', '', (string) $value) ?? '';
        if ($digits === '') {
            return null;
        }
        return $digits;
    }
}

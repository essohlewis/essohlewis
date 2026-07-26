<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Internationalisation minimaliste (Sprint +2).
 * Charge un fichier de langue (app/Lang/{locale}.php) et traduit par clé,
 * avec substitution de variables {nom} et repli sur la clé si absente.
 */
final class I18n
{
    private const AVAILABLE = ['fr', 'en'];
    private const DEFAULT = 'fr';

    private static string $locale = self::DEFAULT;
    private static array $messages = [];

    /** Détecte la locale (cookie > en-tête Accept-Language > défaut) et charge les messages. */
    public static function boot(?string $locale = null): void
    {
        self::setLocale($locale ?? self::detect());
    }

    public static function detect(): string
    {
        $cookie = $_COOKIE['amoura_lang'] ?? null;
        if (is_string($cookie) && in_array($cookie, self::AVAILABLE, true)) {
            return $cookie;
        }
        $accept = strtolower($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '');
        foreach (self::AVAILABLE as $loc) {
            if (str_starts_with($accept, $loc)) {
                return $loc;
            }
        }
        return self::DEFAULT;
    }

    public static function setLocale(string $locale): void
    {
        if (!in_array($locale, self::AVAILABLE, true)) {
            $locale = self::DEFAULT;
        }
        self::$locale = $locale;
        $file = __DIR__ . '/../Lang/' . $locale . '.php';
        self::$messages = is_file($file) ? (require $file) : [];
    }

    public static function locale(): string
    {
        return self::$locale;
    }

    public static function available(): array
    {
        return self::AVAILABLE;
    }

    public static function isAvailable(string $locale): bool
    {
        return in_array($locale, self::AVAILABLE, true);
    }

    /** Traduit une clé, avec substitution {var}. Repli : traduction FR puis la clé. */
    public static function t(string $key, array $replacements = []): string
    {
        $message = self::$messages[$key] ?? $key;
        foreach ($replacements as $name => $value) {
            $message = str_replace('{' . $name . '}', (string) $value, $message);
        }
        return $message;
    }
}

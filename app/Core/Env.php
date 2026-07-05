<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Chargeur minimaliste de variables d'environnement depuis un fichier .env.
 * Aucune dépendance externe. Les valeurs déjà présentes dans l'environnement
 * réel du serveur ont priorité sur le fichier .env.
 */
final class Env
{
    private static array $vars = [];
    private static bool $loaded = false;

    public static function load(string $path): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;

        if (!is_readable($path)) {
            return;
        }

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);

            // Retire les guillemets encadrants éventuels.
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last  = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            // Interpolation simple ${VAR}.
            $value = preg_replace_callback('/\$\{([A-Z0-9_]+)\}/', static function ($m) {
                return self::$vars[$m[1]] ?? getenv($m[1]) ?: '';
            }, $value);

            self::$vars[$key] = $value;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $fromReal = getenv($key);
        if ($fromReal !== false && $fromReal !== '') {
            return $fromReal;
        }
        return self::$vars[$key] ?? $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null) {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
}

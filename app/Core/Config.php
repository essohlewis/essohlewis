<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Accès à la configuration chargée depuis config/*.php.
 * Support de la notation pointée : Config::get('db.host').
 */
final class Config
{
    private static array $items = [];

    public static function load(string $configDir): void
    {
        foreach (glob($configDir . '/*.php') as $file) {
            $name = basename($file, '.php');
            $data = require $file;

            // config.php contient les domaines racine (app, db, sms, payments...) :
            // ses clés sont fusionnées au niveau racine. Les autres fichiers
            // (ex. operators.php) sont indexés sous leur nom de base.
            if ($name === 'config' && is_array($data)) {
                self::$items = array_merge(self::$items, $data);
            } else {
                self::$items[$name] = $data;
            }
        }
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $segments = explode('.', $key);
        $value    = self::$items;

        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    public static function set(string $key, mixed $value): void
    {
        self::$items[$key] = $value;
    }
}

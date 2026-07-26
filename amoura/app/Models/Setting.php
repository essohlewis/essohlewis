<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Paramètres du site (CMS), avec cache mémoire par requête. */
final class Setting extends Model
{
    protected string $table = 'settings';
    private static array $cache = [];

    /**
     * Tous les paramètres sous forme clé => valeur typée.
     * Cache à deux niveaux : mémoire (requête) + cache partagé (Redis si configuré,
     * sinon mémoire) avec TTL, pour éviter une requête SQL à chaque page.
     */
    public function values(): array
    {
        if (self::$cache) {
            return self::$cache;
        }
        self::$cache = \Amoura\Core\Cache\Cache::remember('settings:all', 300, function () {
            $rows = $this->db->query('SELECT `key`, value, type FROM settings')->fetchAll();
            $out = [];
            foreach ($rows as $row) {
                $out[$row['key']] = $this->cast($row['value'], $row['type']);
            }
            return $out;
        });
        return self::$cache;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $all = $this->values();
        return $all[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $stored = is_array($value) ? json_encode($value) : (is_bool($value) ? ($value ? '1' : '0') : (string) $value);
        $this->run(
            'INSERT INTO settings (`key`, value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [$key, $stored]
        );
        self::$cache = [];                                   // cache mémoire (requête)
        \Amoura\Core\Cache\Cache::forget('settings:all');    // cache partagé (Redis/mémoire)
    }

    public function grouped(): array
    {
        $rows = $this->db->query('SELECT * FROM settings ORDER BY `group`, `key`')->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $out[$row['group']][] = $row;
        }
        return $out;
    }

    private function cast(mixed $value, string $type): mixed
    {
        return match ($type) {
            'int'  => (int) $value,
            'bool' => in_array((string) $value, ['1', 'true', 'on'], true),
            'json' => json_decode((string) $value, true),
            default => $value,
        };
    }
}

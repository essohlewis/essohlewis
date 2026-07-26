<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Paramètres du site (CMS), avec cache mémoire par requête. */
final class Setting extends Model
{
    protected string $table = 'settings';
    private static array $cache = [];

    public function all(): array
    {
        if (self::$cache) {
            return self::$cache;
        }
        $rows = $this->db->query('SELECT `key`, value, type FROM settings')->fetchAll();
        foreach ($rows as $row) {
            self::$cache[$row['key']] = $this->cast($row['value'], $row['type']);
        }
        return self::$cache;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $all = $this->all();
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
        unset(self::$cache[$key]);
        self::$cache = []; // invalide le cache
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

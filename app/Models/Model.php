<?php

declare(strict_types=1);

namespace Transouscris\Models;

use PDO;
use Transouscris\Core\Database;

/**
 * Modèle actif minimal (pattern Active Record léger) sur PDO.
 * Chaque sous-classe déclare $table et ses colonnes publiques.
 */
abstract class Model
{
    protected static string $table = '';
    public ?int $id = null;

    public static function pdo(): PDO
    {
        return Database::connection();
    }

    /** Hydrate une instance depuis un tableau associatif. */
    public static function hydrate(array $row): static
    {
        $model = new static();
        foreach ($row as $key => $value) {
            $camel = self::toCamel($key);
            if (property_exists($model, $camel)) {
                $model->$camel = self::castFor($model, $camel, $value);
            } elseif (property_exists($model, $key)) {
                $model->$key = self::castFor($model, $key, $value);
            }
        }
        return $model;
    }

    public static function find(int $id): ?static
    {
        $stmt = self::pdo()->prepare('SELECT * FROM ' . static::$table . ' WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ? static::hydrate($row) : null;
    }

    /** @return static[] */
    public static function where(string $column, mixed $value): array
    {
        $stmt = self::pdo()->prepare('SELECT * FROM ' . static::$table . ' WHERE ' . $column . ' = :v');
        $stmt->execute(['v' => $value]);
        return array_map(static fn ($r) => static::hydrate($r), $stmt->fetchAll());
    }

    public static function firstWhere(string $column, mixed $value): ?static
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM ' . static::$table . ' WHERE ' . $column . ' = :v LIMIT 1'
        );
        $stmt->execute(['v' => $value]);
        $row = $stmt->fetch();
        return $row ? static::hydrate($row) : null;
    }

    private static function toCamel(string $snake): string
    {
        return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $snake))));
    }

    /** Cast basique : les propriétés typées int reçoivent des int. */
    private static function castFor(object $model, string $prop, mixed $value): mixed
    {
        if ($value === null) {
            return null;
        }
        try {
            $rp = new \ReflectionProperty($model, $prop);
            $type = $rp->getType();
            if ($type instanceof \ReflectionNamedType) {
                return match ($type->getName()) {
                    'int'   => (int) $value,
                    'float' => (float) $value,
                    'bool'  => (bool) $value,
                    default => $value,
                };
            }
        } catch (\ReflectionException) {
        }
        return $value;
    }
}

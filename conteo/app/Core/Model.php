<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * Modèle de base : accès aux données via PDO, exclusivement en requêtes
 * préparées. Les modèles concrets fixent $table.
 */
abstract class Model
{
    protected string $table = '';

    protected function db(): PDO
    {
        return Database::connection();
    }

    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = $this->db()->prepare("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** @return array<string,mixed>|null */
    public function findBy(string $column, mixed $value): ?array
    {
        $col = $this->safeColumn($column);
        $stmt = $this->db()->prepare("SELECT * FROM {$this->table} WHERE {$col} = ? LIMIT 1");
        $stmt->execute([$value]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * @param array<string,mixed> $data
     * @return int ID inséré
     */
    public function insert(array $data): int
    {
        $cols = array_map([$this, 'safeColumn'], array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->table,
            implode(', ', $cols),
            $placeholders
        );
        $stmt = $this->db()->prepare($sql);
        $stmt->execute(array_values($data));
        return (int) $this->db()->lastInsertId();
    }

    /**
     * @param array<string,mixed> $data
     */
    public function update(int $id, array $data): bool
    {
        if (!$data) {
            return false;
        }
        $sets = implode(', ', array_map(fn ($c) => $this->safeColumn($c) . ' = ?', array_keys($data)));
        $sql = "UPDATE {$this->table} SET {$sets} WHERE id = ?";
        $stmt = $this->db()->prepare($sql);
        $values = array_values($data);
        $values[] = $id;
        return $stmt->execute($values);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db()->prepare("DELETE FROM {$this->table} WHERE id = ?");
        return $stmt->execute([$id]);
    }

    /**
     * Empêche l'injection via un nom de colonne dynamique.
     * Seuls les identifiants alphanumériques + underscore sont admis.
     */
    protected function safeColumn(string $column): string
    {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column)) {
            throw new \InvalidArgumentException('Invalid column name.');
        }
        return $column;
    }
}

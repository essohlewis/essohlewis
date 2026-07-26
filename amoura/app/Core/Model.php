<?php
declare(strict_types=1);

namespace Amoura\Core;

use PDO;

/**
 * Modèle de base. Fournit un accès PDO et des helpers CRUD génériques.
 * IMPORTANT : toutes les valeurs utilisateur passent par des requêtes préparées.
 * Les noms de tables/colonnes ne sont jamais issus d'entrées utilisateur.
 */
abstract class Model
{
    protected string $table;
    protected string $primaryKey = 'id';
    protected PDO $db;

    public function __construct()
    {
        $this->db = Database::connection();
    }

    public function db(): PDO
    {
        return $this->db;
    }

    /** Exécute une requête préparée et renvoie le statement. */
    protected function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function find(int|string $id): ?array
    {
        $stmt = $this->run(
            "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = ? LIMIT 1",
            [$id]
        );
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Recherche par colonne — la colonne provient du code, jamais de l'utilisateur. */
    public function findBy(string $column, mixed $value): ?array
    {
        $this->assertColumn($column);
        $stmt = $this->run("SELECT * FROM {$this->table} WHERE {$column} = ? LIMIT 1", [$value]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function all(int $limit = 100, int $offset = 0): array
    {
        $stmt = $this->run(
            "SELECT * FROM {$this->table} ORDER BY {$this->primaryKey} DESC LIMIT ? OFFSET ?",
            [$limit, $offset]
        );
        return $stmt->fetchAll();
    }

    public function create(array $data): int
    {
        $columns = array_keys($data);
        foreach ($columns as $c) {
            $this->assertColumn($c);
        }
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $cols = implode(', ', array_map(fn($c) => "`{$c}`", $columns));
        $this->run(
            "INSERT INTO {$this->table} ({$cols}) VALUES ({$placeholders})",
            array_values($data)
        );
        return (int) $this->db->lastInsertId();
    }

    public function update(int|string $id, array $data): bool
    {
        $sets = [];
        $params = [];
        foreach ($data as $col => $val) {
            $this->assertColumn($col);
            $sets[] = "`{$col}` = ?";
            $params[] = $val;
        }
        $params[] = $id;
        $sql = "UPDATE {$this->table} SET " . implode(', ', $sets)
             . " WHERE {$this->primaryKey} = ?";
        return $this->run($sql, $params)->rowCount() >= 0;
    }

    public function delete(int|string $id): bool
    {
        return $this->run(
            "DELETE FROM {$this->table} WHERE {$this->primaryKey} = ?",
            [$id]
        )->rowCount() > 0;
    }

    /** Transaction avec fermeture — rollback automatique sur exception. */
    public function transaction(callable $callback): mixed
    {
        $this->db->beginTransaction();
        try {
            $result = $callback($this->db);
            $this->db->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Garde-fou : empêche l'injection d'identifiants via des noms de colonnes
     * dynamiques. N'autorise que [a-z0-9_].
     */
    protected function assertColumn(string $column): void
    {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column)) {
            throw new \InvalidArgumentException("Nom de colonne invalide : {$column}");
        }
    }
}

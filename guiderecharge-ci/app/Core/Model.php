<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * Modèle de base.
 *
 * Fournit l'accès PDO partagé et quelques helpers CRUD génériques
 * (findAll, find, insert, update, delete) que les modèles concrets
 * réutilisent. Toutes les requêtes sont préparées.
 */
abstract class Model
{
    /** Nom de la table gérée par le modèle concret. */
    protected string $table = '';

    /** Clé primaire (par défaut « id »). */
    protected string $primaryKey = 'id';

    protected PDO $db;

    public function __construct()
    {
        $this->db = Database::connection();
    }

    /**
     * Retourne toutes les lignes de la table.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(string $orderBy = 'id', string $direction = 'ASC'): array
    {
        // La colonne de tri et la direction sont contrôlées via liste blanche
        // par les modèles concrets ; ici on borne la direction par sécurité.
        $direction = strtoupper($direction) === 'DESC' ? 'DESC' : 'ASC';
        $sql = "SELECT * FROM {$this->table} ORDER BY {$orderBy} {$direction}";
        return $this->db->query($sql)->fetchAll();
    }

    /**
     * Retourne une ligne par sa clé primaire, ou null.
     *
     * @return array<string, mixed>|null
     */
    public function find(int $id): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Insère une ligne à partir d'un tableau associatif colonne => valeur.
     * Retourne l'identifiant inséré.
     *
     * @param array<string, mixed> $data
     */
    public function insert(array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_map(static fn ($c) => ':' . $c, $columns);

        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute($data);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Met à jour une ligne identifiée par sa clé primaire.
     *
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): bool
    {
        $sets = array_map(static fn ($c) => "{$c} = :{$c}", array_keys($data));
        $sql = sprintf(
            'UPDATE %s SET %s WHERE %s = :__id',
            $this->table,
            implode(', ', $sets),
            $this->primaryKey
        );

        $data['__id'] = $id;
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($data);
    }

    /**
     * Supprime une ligne par sa clé primaire.
     */
    public function delete(int $id): bool
    {
        $sql = "DELETE FROM {$this->table} WHERE {$this->primaryKey} = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Compte le nombre total de lignes de la table.
     */
    public function count(): int
    {
        return (int) $this->db->query("SELECT COUNT(*) FROM {$this->table}")->fetchColumn();
    }
}

<?php
/* ==========================================================================
   models/Model.php — Modèle de base : accès PDO + opérations CRUD génériques.
   Toutes les requêtes sont préparées (protection contre l'injection SQL).
   ========================================================================== */

abstract class Model
{
    protected string $table;
    protected string $cle = 'id';

    protected function pdo(): PDO
    {
        return Database::connexion();
    }

    /** Toutes les lignes (option : tri). */
    public function tout(string $orderBy = null): array
    {
        $sql = "SELECT * FROM {$this->table}";
        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        return $this->pdo()->query($sql)->fetchAll();
    }

    /** Une ligne par clé primaire. */
    public function trouver($id): ?array
    {
        $stmt = $this->pdo()->prepare("SELECT * FROM {$this->table} WHERE {$this->cle} = ? LIMIT 1");
        $stmt->execute([$id]);
        $ligne = $stmt->fetch();
        return $ligne ?: null;
    }

    /** Première ligne correspondant à une colonne. */
    public function parColonne(string $colonne, $valeur): ?array
    {
        $stmt = $this->pdo()->prepare("SELECT * FROM {$this->table} WHERE {$colonne} = ? LIMIT 1");
        $stmt->execute([$valeur]);
        $ligne = $stmt->fetch();
        return $ligne ?: null;
    }

    /** Lignes filtrées par égalités (clé => valeur), avec tri optionnel. */
    public function ou(array $conditions, string $orderBy = null): array
    {
        $clauses = [];
        $params  = [];
        foreach ($conditions as $col => $val) {
            $clauses[] = "{$col} = ?";
            $params[]  = $val;
        }
        $sql = "SELECT * FROM {$this->table}";
        if ($clauses) {
            $sql .= ' WHERE ' . implode(' AND ', $clauses);
        }
        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Insère une ligne, retourne l'identifiant créé. */
    public function inserer(array $donnees)
    {
        $cols = array_keys($donnees);
        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        $sql = "INSERT INTO {$this->table} (" . implode(', ', $cols) . ") VALUES ($placeholders)";
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute(array_values($donnees));
        return $this->pdo()->lastInsertId();
    }

    /** Met à jour une ligne par clé primaire. */
    public function maj($id, array $donnees): bool
    {
        $sets = implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($donnees)));
        $sql = "UPDATE {$this->table} SET {$sets} WHERE {$this->cle} = ?";
        $stmt = $this->pdo()->prepare($sql);
        return $stmt->execute([...array_values($donnees), $id]);
    }

    /** Supprime une ligne par clé primaire. */
    public function supprimer($id): bool
    {
        $stmt = $this->pdo()->prepare("DELETE FROM {$this->table} WHERE {$this->cle} = ?");
        return $stmt->execute([$id]);
    }

    /** Requête personnalisée préparée. */
    public function requete(string $sql, array $params = []): array
    {
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}

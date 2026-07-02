<?php
/**
 * Modèle de base : accès à la connexion PDO partagée + petits helpers.
 */

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

abstract class Model
{
    protected PDO $db;

    public function __construct()
    {
        // La connexion a déjà été initialisée dans bootstrap.php.
        $this->db = Database::pdo();
    }
}

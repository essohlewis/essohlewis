<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Database;
use PDO;
use PHPUnit\Framework\TestCase;

/**
 * Base des tests d'intégration : recrée une base fraîche (schéma + données)
 * avant chaque test et l'injecte dans le singleton PDO applicatif.
 * Les tests sont automatiquement ignorés si aucun serveur MySQL n'est joignable.
 */
abstract class IntegrationTestCase extends TestCase
{
    protected PDO $db;

    protected function setUp(): void
    {
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') ?: '';
        $name = getenv('DB_NAME') ?: 'amoura_test';

        try {
            $root = new PDO("mysql:host={$host};port={$port}", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 3,
            ]);
        } catch (\PDOException $e) {
            $this->markTestSkipped('Serveur MySQL indisponible — test d\'intégration ignoré.');
        }

        $base = dirname(__DIR__, 2) . '/database';
        $root->exec("DROP DATABASE IF EXISTS `{$name}`");
        $root->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $root->exec("USE `{$name}`");
        $root->exec(file_get_contents($base . '/schema.sql'));
        $root->exec(file_get_contents($base . '/seed.sql'));

        $this->db = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        Database::setConnection($this->db);
    }

    /** Crée un utilisateur actif prêt pour les tests. */
    protected function makeUser(string $email, string $gender = 'female'): int
    {
        $id = (new \Amoura\Models\User())->create([
            'email' => $email,
            'password_hash' => \Amoura\Core\Security\Auth::hash('Passw0rd'),
            'display_name' => ucfirst(explode('@', $email)[0]),
            'birthdate' => '1995-01-01',
            'gender' => $gender,
            'status' => 'active',
            'email_verified_at' => date('Y-m-d H:i:s'),
        ]);
        (new \Amoura\Models\Profile())->ensureExists($id);
        return $id;
    }
}

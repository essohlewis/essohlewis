<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Utilisateur de la plateforme. L'authentification se fait par téléphone + OTP ;
 * le mot de passe est optionnel (activable pour le back-office).
 */
final class User extends Model
{
    protected static string $table = 'users';

    public ?int $id = null;
    public string $phone = '';
    public ?string $name = null;
    public ?string $email = null;
    public ?string $passwordHash = null;
    public string $role = 'customer';      // customer | agent | admin
    public string $status = 'active';      // active | suspended
    public bool $phoneVerified = false;
    public ?string $createdAt = null;

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isAgent(): bool
    {
        return $this->role === 'agent';
    }

    public static function findByPhone(string $phone): ?self
    {
        return self::firstWhere('phone', $phone);
    }

    /**
     * Crée un utilisateur (non vérifié). Le téléphone doit être normalisé E.164
     * sans le +, ex: 2250700000000.
     */
    public static function create(string $phone, ?string $name = null): self
    {
        $stmt = self::pdo()->prepare(
            'INSERT INTO users (phone, name, role, status, phone_verified, created_at)
             VALUES (:phone, :name, :role, :status, 0, NOW())'
        );
        $stmt->execute([
            'phone'  => $phone,
            'name'   => $name,
            'role'   => 'customer',
            'status' => 'active',
        ]);
        return self::find((int) self::pdo()->lastInsertId());
    }

    public function markPhoneVerified(): void
    {
        self::pdo()->prepare('UPDATE users SET phone_verified = 1 WHERE id = :id')
            ->execute(['id' => $this->id]);
        $this->phoneVerified = true;
    }

    /** Récupère (ou crée à la volée) le compte-portefeuille de l'utilisateur. */
    public function wallet(): LedgerAccount
    {
        return LedgerAccount::forUser($this->id);
    }
}

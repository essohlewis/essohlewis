<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Code OTP à usage unique. Le code n'est JAMAIS stocké en clair : seul son
 * hash (SHA-256 + sel applicatif) est conservé, comparé en temps constant.
 */
final class OtpCode extends Model
{
    protected static string $table = 'otp_codes';

    public ?int $id = null;
    public string $phone = '';
    public string $codeHash = '';
    public string $purpose = 'login';   // login | recharge_confirm
    public int $attempts = 0;
    public ?string $expiresAt = null;
    public ?string $consumedAt = null;
    public ?string $createdAt = null;

    public static function issue(string $phone, string $codeHash, string $purpose, int $ttlSeconds): self
    {
        // Invalide les codes précédents non consommés pour ce numéro+usage.
        self::pdo()->prepare(
            'UPDATE otp_codes SET consumed_at = NOW()
             WHERE phone = :p AND purpose = :pu AND consumed_at IS NULL'
        )->execute(['p' => $phone, 'pu' => $purpose]);

        self::pdo()->prepare(
            'INSERT INTO otp_codes (phone, code_hash, purpose, attempts, expires_at, created_at)
             VALUES (:p, :h, :pu, 0, DATE_ADD(NOW(), INTERVAL :ttl SECOND), NOW())'
        )->execute(['p' => $phone, 'h' => $codeHash, 'pu' => $purpose, 'ttl' => $ttlSeconds]);

        return self::find((int) self::pdo()->lastInsertId());
    }

    public static function activeFor(string $phone, string $purpose): ?self
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM otp_codes
             WHERE phone = :p AND purpose = :pu AND consumed_at IS NULL AND expires_at > NOW()
             ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute(['p' => $phone, 'pu' => $purpose]);
        $row = $stmt->fetch();
        return $row ? self::hydrate($row) : null;
    }

    public function incrementAttempts(): void
    {
        self::pdo()->prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = :id')
            ->execute(['id' => $this->id]);
        $this->attempts++;
    }

    public function consume(): void
    {
        self::pdo()->prepare('UPDATE otp_codes SET consumed_at = NOW() WHERE id = :id')
            ->execute(['id' => $this->id]);
        $this->consumedAt = date('c');
    }
}

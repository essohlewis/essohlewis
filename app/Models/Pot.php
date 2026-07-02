<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Cagnotte de recharge collective : plusieurs personnes cotisent via un lien
 * partageable pour recharger un bénéficiaire. Fonctionnalité différenciante.
 */
final class Pot extends Model
{
    protected static string $table = 'pots';

    public ?int $id = null;
    public int $ownerUserId = 0;
    public string $slug = '';               // segment public du lien partageable
    public string $title = '';
    public string $beneficiaryMsisdn = '';
    public ?string $operatorCode = null;
    public int $targetAmount = 0;
    public int $collectedAmount = 0;
    public string $status = 'open';         // open | funded | disbursed | closed
    public ?string $expiresAt = null;
    public ?string $createdAt = null;

    public static function create(int $ownerUserId, string $title, string $beneficiaryMsisdn, int $targetAmount): self
    {
        $slug = self::uniqueSlug();
        self::pdo()->prepare(
            'INSERT INTO pots (owner_user_id, slug, title, beneficiary_msisdn, target_amount, collected_amount, status, created_at)
             VALUES (:uid, :slug, :title, :msisdn, :target, 0, :status, NOW())'
        )->execute([
            'uid'    => $ownerUserId,
            'slug'   => $slug,
            'title'  => $title,
            'msisdn' => $beneficiaryMsisdn,
            'target' => $targetAmount,
            'status' => 'open',
        ]);
        return self::find((int) self::pdo()->lastInsertId());
    }

    public static function findBySlug(string $slug): ?self
    {
        return self::firstWhere('slug', $slug);
    }

    /** Ajoute un montant collecté (appelé après confirmation d'une contribution). */
    public function addCollected(int $amount): void
    {
        self::pdo()->prepare(
            'UPDATE pots
             SET collected_amount = collected_amount + :amt,
                 status = IF(collected_amount + :amt >= target_amount, \'funded\', status)
             WHERE id = :id'
        )->execute(['amt' => $amount, 'id' => $this->id]);
        $this->collectedAmount += $amount;
    }

    public function progressPercent(): int
    {
        if ($this->targetAmount <= 0) {
            return 0;
        }
        return (int) min(100, floor($this->collectedAmount * 100 / $this->targetAmount));
    }

    private static function uniqueSlug(): string
    {
        do {
            $slug = substr(bin2hex(random_bytes(6)), 0, 10);
        } while (self::firstWhere('slug', $slug) !== null);
        return $slug;
    }
}

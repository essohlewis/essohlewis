<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class ChildProfile extends Model
{
    protected string $table = 'child_profiles';

    /** Profils appartenant à un parent. @return array<int,array<string,mixed>> */
    public function forUser(int $userId): array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM child_profiles WHERE user_id = ? ORDER BY created_at ASC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function countForUser(int $userId): int
    {
        $stmt = $this->db()->prepare('SELECT COUNT(*) FROM child_profiles WHERE user_id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Vérifie l'appartenance d'un profil à un parent (protection IDOR).
     * @return array<string,mixed>|null
     */
    public function findOwned(int $childId, int $userId): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM child_profiles WHERE id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->execute([$childId, $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Calcule le niveau de lecture (N1/N2/N3) à partir de l'âge.
     * 2–3 ans → N1, 4–5 ans → N2, 6–7+ ans → N3.
     */
    public static function levelForAge(int $birthYear, int $birthMonth): string
    {
        $now = new \DateTimeImmutable('now');
        $birth = \DateTimeImmutable::createFromFormat(
            'Y-n-j',
            sprintf('%d-%d-1', $birthYear, max(1, min(12, $birthMonth)))
        );
        if ($birth === false) {
            return 'N2';
        }
        $ageYears = $now->diff($birth)->y;

        if ($ageYears <= 3) {
            return 'N1';
        }
        if ($ageYears <= 5) {
            return 'N2';
        }
        return 'N3';
    }
}

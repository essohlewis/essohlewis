<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class PackPurchase extends Model
{
    protected string $table = 'pack_purchases';

    /** IDs des packs achetés (payés) par l'utilisateur. @return int[] */
    public function paidPackIds(int $userId): array
    {
        $stmt = $this->db()->prepare(
            'SELECT pack_id FROM pack_purchases WHERE user_id = ? AND status = "paid"'
        );
        $stmt->execute([$userId]);
        return array_map('intval', array_column($stmt->fetchAll(), 'pack_id'));
    }

    public function markPaid(int $purchaseId): void
    {
        $stmt = $this->db()->prepare('UPDATE pack_purchases SET status = "paid" WHERE id = ?');
        $stmt->execute([$purchaseId]);
    }

    /**
     * Crée (ou réutilise) une ligne d'achat en attente pour user+pack.
     * Respecte la contrainte unique uq_user_pack. Renvoie l'ID de la ligne.
     */
    public function ensurePending(int $userId, int $packId, int $amountFcfa): int
    {
        $stmt = $this->db()->prepare(
            'INSERT INTO pack_purchases (user_id, pack_id, amount_fcfa, status)
             VALUES (?, ?, ?, "pending")
             ON DUPLICATE KEY UPDATE
                amount_fcfa = VALUES(amount_fcfa),
                id = LAST_INSERT_ID(id)'
        );
        $stmt->execute([$userId, $packId, $amountFcfa]);
        return (int) $this->db()->lastInsertId();
    }

    /** @return array<string,mixed>|null */
    public function findPending(int $userId, int $packId): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM pack_purchases WHERE user_id = ? AND pack_id = ? LIMIT 1'
        );
        $stmt->execute([$userId, $packId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}

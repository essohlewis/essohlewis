<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Transaction extends Model
{
    protected string $table = 'transactions';

    public function initiate(int $userId, ?int $planId, int $amountCents, string $currency, string $gateway, array $extra = []): int
    {
        return $this->create(array_merge([
            'user_id' => $userId,
            'plan_id' => $planId,
            'amount_cents' => $amountCents,
            'currency' => $currency,
            'gateway' => $gateway,
            'status' => 'initiated',
        ], $extra));
    }

    public function byGatewayRef(string $gateway, string $ref): ?array
    {
        $row = $this->run(
            'SELECT * FROM transactions WHERE gateway = ? AND gateway_ref = ? LIMIT 1',
            [$gateway, $ref]
        )->fetch();
        return $row ?: null;
    }

    /**
     * Marque une transaction comme payée de façon idempotente.
     * @return bool true si la transition a réellement eu lieu (première fois).
     */
    public function markPaid(int $txId, string $gatewayRef): bool
    {
        return $this->transaction(function ($db) use ($txId, $gatewayRef) {
            $stmt = $db->prepare('SELECT status FROM transactions WHERE id = ? FOR UPDATE');
            $stmt->execute([$txId]);
            $status = $stmt->fetchColumn();
            if ($status === false || $status === 'paid') {
                return false; // déjà traité ou inexistant
            }
            $db->prepare(
                'UPDATE transactions SET status = "paid", gateway_ref = ?, paid_at = NOW() WHERE id = ?'
            )->execute([$gatewayRef, $txId]);
            return true;
        });
    }

    public function markFailed(int $txId): void
    {
        $this->run('UPDATE transactions SET status = "failed" WHERE id = ?', [$txId]);
    }

    public function revenueStats(): array
    {
        $db = $this->db;
        return [
            'total_cents' => (int) $db->query('SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE status="paid"')->fetchColumn(),
            'month_cents' => (int) $db->query('SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE status="paid" AND paid_at >= DATE_FORMAT(NOW(),"%Y-%m-01")')->fetchColumn(),
            'paid_count'  => (int) $db->query('SELECT COUNT(*) FROM transactions WHERE status="paid"')->fetchColumn(),
        ];
    }

    public function recent(int $limit = 25, int $offset = 0): array
    {
        return $this->run(
            'SELECT t.*, u.display_name FROM transactions t
             JOIN users u ON u.id = t.user_id
             ORDER BY t.created_at DESC LIMIT ? OFFSET ?',
            [$limit, $offset]
        )->fetchAll();
    }

    /** Historique de facturation d'un utilisateur (avec libellé d'article). */
    public function forUser(int $userId, int $limit = 50): array
    {
        return $this->run(
            'SELECT t.*, p.name AS plan_name, pr.name AS product_name
             FROM transactions t
             LEFT JOIN plans p    ON p.id = t.plan_id
             LEFT JOIN products pr ON pr.id = t.product_id
             WHERE t.user_id = ?
             ORDER BY t.created_at DESC LIMIT ?',
            [$userId, $limit]
        )->fetchAll();
    }

    /** Transaction payée d'un utilisateur, pour l'édition d'un reçu (sinon null). */
    public function receiptFor(int $txId, int $userId): ?array
    {
        $row = $this->run(
            'SELECT t.*, p.name AS plan_name, pr.name AS product_name
             FROM transactions t
             LEFT JOIN plans p    ON p.id = t.plan_id
             LEFT JOIN products pr ON pr.id = t.product_id
             WHERE t.id = ? AND t.user_id = ? AND t.status = "paid"
             LIMIT 1',
            [$txId, $userId]
        )->fetch();
        return $row ?: null;
    }
}

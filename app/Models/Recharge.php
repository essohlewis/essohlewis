<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Ordre de recharge (crédit ou forfait) passé sur un numéro cible.
 *
 * Cycle de vie : pending → dispatched → success | failed → refunded.
 * `guarantee_deadline` porte l'échéance au-delà de laquelle, sans confirmation
 * opérateur, la garantie de remboursement automatique se déclenche.
 */
final class Recharge extends Model
{
    protected static string $table = 'recharges';

    public ?int $id = null;
    public int $userId = 0;
    public ?int $agentId = null;
    public ?int $planId = null;
    public string $operatorCode = '';
    public string $msisdn = '';
    public string $type = 'credit';       // credit | internet | voice | sms
    public int $amount = 0;
    public string $status = 'pending';    // pending | dispatched | success | failed | refunded
    public ?int $ledgerTransactionId = null;
    public ?string $operatorRef = null;
    public ?string $guaranteeDeadline = null;
    public ?string $createdAt = null;
    public ?string $completedAt = null;

    public static function open(int $userId, string $operatorCode, string $msisdn, int $amount, string $type, ?int $planId, int $guaranteeDelaySeconds): self
    {
        self::pdo()->prepare(
            'INSERT INTO recharges
                (user_id, operator_code, msisdn, amount, type, plan_id, status, guarantee_deadline, created_at)
             VALUES (:uid, :op, :msisdn, :amount, :type, :plan, :status, DATE_ADD(NOW(), INTERVAL :delay SECOND), NOW())'
        )->execute([
            'uid'    => $userId,
            'op'     => $operatorCode,
            'msisdn' => $msisdn,
            'amount' => $amount,
            'type'   => $type,
            'plan'   => $planId,
            'status' => 'pending',
            'delay'  => $guaranteeDelaySeconds,
        ]);
        return self::find((int) self::pdo()->lastInsertId());
    }

    public function setStatus(string $status, ?string $operatorRef = null): void
    {
        $completed = in_array($status, ['success', 'failed', 'refunded'], true);
        self::pdo()->prepare(
            'UPDATE recharges
             SET status = :s, operator_ref = COALESCE(:ref, operator_ref),
                 completed_at = ' . ($completed ? 'NOW()' : 'completed_at') . '
             WHERE id = :id'
        )->execute(['s' => $status, 'ref' => $operatorRef, 'id' => $this->id]);
        $this->status = $status;
    }

    public function linkLedger(int $ledgerTransactionId): void
    {
        self::pdo()->prepare('UPDATE recharges SET ledger_transaction_id = :l WHERE id = :id')
            ->execute(['l' => $ledgerTransactionId, 'id' => $this->id]);
        $this->ledgerTransactionId = $ledgerTransactionId;
    }

    /** @return self[] recharges à rembourser : en attente au-delà de l'échéance. */
    public static function overdueForGuarantee(): array
    {
        $stmt = self::pdo()->query(
            "SELECT * FROM recharges
             WHERE status IN ('pending','dispatched')
               AND guarantee_deadline < NOW()"
        );
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    /** @return self[] */
    public static function forUser(int $userId, int $limit = 50): array
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM recharges WHERE user_id = :uid ORDER BY id DESC LIMIT :lim'
        );
        $stmt->bindValue('uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }
}

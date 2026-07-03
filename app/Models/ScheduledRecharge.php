<?php

declare(strict_types=1);

namespace Transouscris\Models;

use PDO;

/**
 * Recharge programmée (récurrente) : recharge automatique d'un montant fixe
 * vers un numéro, à intervalle régulier. Fonctionnalité différenciante.
 *
 * `next_run_at` porte la prochaine échéance ; le worker (scheduled:run) exécute
 * les programmations dues puis les replanifie selon la fréquence.
 */
final class ScheduledRecharge extends Model
{
    protected static string $table = 'scheduled_recharges';

    public ?int $id = null;
    public int $userId = 0;
    public string $msisdn = '';
    public string $operatorCode = '';
    public int $rechargeAmount = 0;
    public ?int $thresholdAmount = null;
    public string $frequency = 'monthly';   // monthly | weekly | threshold
    public ?string $nextRunAt = null;
    public bool $isActive = true;
    public ?string $createdAt = null;

    /** Intervalle SQL correspondant à une fréquence. */
    private static function interval(string $frequency): string
    {
        return match ($frequency) {
            'weekly' => 'INTERVAL 1 WEEK',
            default  => 'INTERVAL 1 MONTH',
        };
    }

    public static function createFor(int $userId, string $msisdn, string $operatorCode, int $amount, string $frequency): self
    {
        $interval = self::interval($frequency);
        // Première échéance : maintenant + un intervalle.
        self::pdo()->prepare(
            "INSERT INTO scheduled_recharges
                (user_id, msisdn, operator_code, recharge_amount, frequency, next_run_at, is_active, created_at)
             VALUES (:uid, :msisdn, :op, :amount, :freq, DATE_ADD(NOW(), $interval), 1, NOW())"
        )->execute([
            'uid'    => $userId,
            'msisdn' => $msisdn,
            'op'     => $operatorCode,
            'amount' => $amount,
            'freq'   => $frequency,
        ]);
        return self::find((int) self::pdo()->lastInsertId());
    }

    /** @return self[] programmations actives d'un utilisateur. */
    public static function forUser(int $userId): array
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM scheduled_recharges WHERE user_id = :uid ORDER BY id DESC'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    /**
     * @return self[] programmations dues (verrou pessimiste posé par le worker).
     * Doit être appelé à l'intérieur d'une transaction.
     */
    public static function lockDue(PDO $pdo): array
    {
        $stmt = $pdo->query(
            "SELECT * FROM scheduled_recharges
             WHERE is_active = 1 AND frequency IN ('monthly','weekly')
               AND next_run_at IS NOT NULL AND next_run_at <= NOW()
             ORDER BY id ASC
             FOR UPDATE"
        );
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    /** Replanifie la prochaine échéance selon la fréquence. */
    public function reschedule(): void
    {
        $interval = self::interval($this->frequency);
        self::pdo()->prepare(
            "UPDATE scheduled_recharges SET next_run_at = DATE_ADD(NOW(), $interval) WHERE id = :id"
        )->execute(['id' => $this->id]);
    }

    public function setActive(bool $active): void
    {
        self::pdo()->prepare('UPDATE scheduled_recharges SET is_active = :a WHERE id = :id')
            ->execute(['a' => $active ? 1 : 0, 'id' => $this->id]);
        $this->isActive = $active;
    }

    public function delete(): void
    {
        self::pdo()->prepare('DELETE FROM scheduled_recharges WHERE id = :id')
            ->execute(['id' => $this->id]);
    }

    public function frequencyLabel(): string
    {
        return match ($this->frequency) {
            'weekly'    => 'Hebdomadaire',
            'threshold' => 'Sur seuil bas',
            default     => 'Mensuelle',
        };
    }
}

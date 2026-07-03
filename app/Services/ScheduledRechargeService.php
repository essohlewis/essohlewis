<?php

declare(strict_types=1);

namespace Transouscris\Services;

use PDO;
use Transouscris\Core\Database;
use Transouscris\Core\Exceptions\InsufficientFundsException;
use Transouscris\Core\Logger;
use Transouscris\Models\ScheduledRecharge;

/**
 * Exécution des recharges programmées (récurrentes).
 *
 * Stratégie « réserver puis exécuter » : les échéances dues sont d'abord
 * verrouillées et replanifiées (claim) dans une transaction courte, PUIS les
 * recharges sont exécutées hors du verrou. Ainsi une exécution qui échoue
 * (solde insuffisant) ne rejoue pas et, surtout, deux workers concurrents ne
 * traitent jamais la même échéance deux fois (aucun double débit).
 */
final class ScheduledRechargeService
{
    public function __construct(
        private RechargeService $recharges = new RechargeService(),
        private AuditLogger $audit = new AuditLogger()
    ) {}

    /**
     * Traite toutes les échéances dues.
     *
     * @return array{executed:int, skipped:int}
     */
    public function runDue(): array
    {
        // 1) Réserve les échéances dues (verrou + replanification), puis relâche.
        /** @var ScheduledRecharge[] $claimed */
        $claimed = Database::transaction(function (PDO $pdo): array {
            $due = ScheduledRecharge::lockDue($pdo);
            foreach ($due as $schedule) {
                $schedule->reschedule();
            }
            return $due;
        });

        // 2) Exécute chaque recharge réservée, indépendamment.
        $executed = 0;
        $skipped  = 0;
        foreach ($claimed as $schedule) {
            if ($this->execute($schedule)) {
                $executed++;
            } else {
                $skipped++;
            }
        }

        return ['executed' => $executed, 'skipped' => $skipped];
    }

    /**
     * Exécute immédiatement une programmation (bouton « Exécuter maintenant »).
     * Verrou pessimiste sur la ligne pour éviter toute course avec le worker.
     *
     * @throws InsufficientFundsException si le portefeuille est insuffisant
     */
    public function runNow(int $userId, int $scheduleId): void
    {
        Database::transaction(function (PDO $pdo) use ($userId, $scheduleId): void {
            $stmt = $pdo->prepare(
                'SELECT * FROM scheduled_recharges WHERE id = :id AND user_id = :uid FOR UPDATE'
            );
            $stmt->execute(['id' => $scheduleId, 'uid' => $userId]);
            $row = $stmt->fetch();
            if ($row === false) {
                throw new \RuntimeException('Programmation introuvable.');
            }
            $schedule = ScheduledRecharge::hydrate($row);

            // Débit + dispatch (transaction imbriquée, exécutée en ligne).
            $this->recharges->rechargeFromWallet(
                userId: $schedule->userId,
                operatorCode: $schedule->operatorCode,
                msisdn: $schedule->msisdn,
                amount: $schedule->rechargeAmount,
                type: 'credit'
            );
            $schedule->reschedule();
        });
    }

    private function execute(ScheduledRecharge $schedule): bool
    {
        try {
            $this->recharges->rechargeFromWallet(
                userId: $schedule->userId,
                operatorCode: $schedule->operatorCode,
                msisdn: $schedule->msisdn,
                amount: $schedule->rechargeAmount,
                type: 'credit'
            );
            $this->audit->log('scheduled.executed', 'scheduled_recharge', $schedule->id, [
                'msisdn' => $schedule->msisdn, 'amount' => $schedule->rechargeAmount,
            ], $schedule->userId);
            return true;
        } catch (InsufficientFundsException $e) {
            // Solde insuffisant : on saute ce cycle (pas de nouvelle tentative
            // avant la prochaine échéance) et on journalise.
            Logger::warning('Recharge programmée sautée (solde insuffisant)', [
                'schedule_id' => $schedule->id, 'user_id' => $schedule->userId,
            ]);
            $this->audit->log('scheduled.skipped', 'scheduled_recharge', $schedule->id, [
                'reason' => 'insufficient_funds',
            ], $schedule->userId);
            return false;
        }
    }
}

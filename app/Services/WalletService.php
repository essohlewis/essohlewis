<?php

declare(strict_types=1);

namespace Transouscris\Services;

use PDO;
use Transouscris\Core\Database;
use Transouscris\Core\Exceptions\InsufficientFundsException;
use Transouscris\Models\LedgerAccount;

/**
 * Cœur financier de Transouscris : grand livre en PARTIE DOUBLE.
 *
 * Toute variation d'argent est enregistrée comme une transaction équilibrée
 * (Σ débits = Σ crédits), composée d'au moins deux écritures (« legs »).
 * Aucun crédit/débit isolé n'est possible : c'est ce qui garantit que la somme
 * des soldes de tous les comptes reste nulle et auditable à tout instant.
 *
 * Garanties d'intégrité :
 *   1. Idempotence   — une `reference` unique empêche le double-traitement d'un
 *                      même événement (webhook rejoué, double clic...).
 *   2. Verrou pessimiste — SELECT ... FOR UPDATE sur chaque compte impacté,
 *                      pris dans l'ordre croissant des id (évite les deadlocks).
 *   3. Équilibre     — la transaction est rejetée si Σ débits ≠ Σ crédits.
 *   4. Solde positif — un compte non autorisé au négatif ne peut être
 *                      sur-débité (InsufficientFundsException, rollback total).
 *   5. Atomicité     — tout se déroule dans une transaction SQL unique.
 */
final class WalletService
{
    public function __construct(private AuditLogger $audit = new AuditLogger()) {}

    /**
     * Enregistre une transaction équilibrée au grand livre.
     *
     * @param string $reference Clé d'idempotence métier (unique).
     * @param string $type      Type métier : wallet_topup, recharge, refund,
     *                          cashback, transfer, fee, contribution...
     * @param array<int, array{account_id:int, direction:'debit'|'credit', amount:int}> $legs
     * @param array  $metadata  Contexte libre (json) — jamais de secret de paiement.
     *
     * @return int  id de la ledger_transaction créée (ou existante si idempotent).
     */
    public function post(string $reference, string $type, array $legs, array $metadata = []): int
    {
        $this->assertBalanced($legs);

        return Database::transaction(function (PDO $pdo) use ($reference, $type, $legs, $metadata) {
            // 1) Idempotence : si la référence existe déjà, on renvoie l'id existant.
            $existing = $pdo->prepare('SELECT id FROM ledger_transactions WHERE reference = :ref LIMIT 1');
            $existing->execute(['ref' => $reference]);
            if ($id = $existing->fetchColumn()) {
                return (int) $id;
            }

            // 2) Verrouillage pessimiste de tous les comptes, triés par id.
            $accountIds = array_values(array_unique(array_map(
                static fn ($l) => (int) $l['account_id'],
                $legs
            )));
            sort($accountIds);

            /** @var array<int, array> $accounts */
            $accounts = [];
            $lockStmt = $pdo->prepare('SELECT * FROM ledger_accounts WHERE id = :id FOR UPDATE');
            foreach ($accountIds as $accId) {
                $lockStmt->execute(['id' => $accId]);
                $row = $lockStmt->fetch();
                if ($row === false) {
                    throw new \RuntimeException("Compte du grand livre introuvable : #$accId");
                }
                $accounts[$accId] = $row;
            }

            // 3) Calcule le delta net par compte (crédit +, débit -).
            $deltas = [];
            foreach ($legs as $leg) {
                $accId  = (int) $leg['account_id'];
                $amount = (int) $leg['amount'];
                if ($amount <= 0) {
                    throw new \InvalidArgumentException('Le montant d\'une écriture doit être strictement positif.');
                }
                $deltas[$accId] = ($deltas[$accId] ?? 0)
                    + ($leg['direction'] === 'credit' ? $amount : -$amount);
            }

            // 4) Vérifie les soldes et prépare les nouveaux soldes.
            $newBalances = [];
            foreach ($deltas as $accId => $delta) {
                $account   = $accounts[$accId];
                $current   = (int) $account['balance'];
                $projected = $current + $delta;

                if ($projected < 0 && (int) $account['allow_negative'] === 0) {
                    throw new InsufficientFundsException($accId, -$delta, $current);
                }
                $newBalances[$accId] = $projected;
            }

            // 5) Crée l'entête de transaction.
            $pdo->prepare(
                'INSERT INTO ledger_transactions (reference, type, status, metadata, created_at)
                 VALUES (:ref, :type, :status, :meta, NOW())'
            )->execute([
                'ref'    => $reference,
                'type'   => $type,
                'status' => 'posted',
                'meta'   => json_encode($metadata, JSON_UNESCAPED_UNICODE),
            ]);
            $txnId = (int) $pdo->lastInsertId();

            // 6) Insère les écritures avec le solde résultant du compte, puis
            //    met à jour le solde en cache de chaque compte.
            $entryStmt = $pdo->prepare(
                'INSERT INTO ledger_entries
                    (ledger_transaction_id, account_id, direction, amount, balance_after, created_at)
                 VALUES (:txn, :acc, :dir, :amt, :bal, NOW())'
            );
            $balanceStmt = $pdo->prepare('UPDATE ledger_accounts SET balance = :bal WHERE id = :id');

            // Applique les deltas au fil des écritures pour un balance_after exact.
            $running = [];
            foreach ($accountIds as $accId) {
                $running[$accId] = (int) $accounts[$accId]['balance'];
            }
            foreach ($legs as $leg) {
                $accId  = (int) $leg['account_id'];
                $amount = (int) $leg['amount'];
                $running[$accId] += ($leg['direction'] === 'credit' ? $amount : -$amount);
                $entryStmt->execute([
                    'txn' => $txnId,
                    'acc' => $accId,
                    'dir' => $leg['direction'],
                    'amt' => $amount,
                    'bal' => $running[$accId],
                ]);
            }
            foreach ($newBalances as $accId => $balance) {
                $balanceStmt->execute(['bal' => $balance, 'id' => $accId]);
            }

            // 7) Journal d'audit (hors transaction critique mais dans la même tx SQL).
            $this->audit->log(
                action: 'ledger.post',
                entityType: 'ledger_transaction',
                entityId: $txnId,
                metadata: ['reference' => $reference, 'type' => $type, 'legs' => $legs]
            );

            return $txnId;
        });
    }

    /**
     * Raccourci : crédite le portefeuille d'un utilisateur depuis un compte système.
     */
    public function credit(int $userId, int $amount, string $reference, string $type, string $sourceCode, array $metadata = []): int
    {
        $wallet = LedgerAccount::forUser($userId);
        $source = LedgerAccount::system($sourceCode);

        return $this->post($reference, $type, [
            ['account_id' => $source->id, 'direction' => 'debit',  'amount' => $amount],
            ['account_id' => $wallet->id, 'direction' => 'credit', 'amount' => $amount],
        ], $metadata + ['user_id' => $userId]);
    }

    /**
     * Raccourci : débite le portefeuille d'un utilisateur vers un compte système.
     * Lève InsufficientFundsException si le solde est insuffisant.
     */
    public function debit(int $userId, int $amount, string $reference, string $type, string $destCode, array $metadata = []): int
    {
        $wallet = LedgerAccount::forUser($userId);
        $dest   = LedgerAccount::system($destCode);

        return $this->post($reference, $type, [
            ['account_id' => $wallet->id, 'direction' => 'debit',  'amount' => $amount],
            ['account_id' => $dest->id,   'direction' => 'credit', 'amount' => $amount],
        ], $metadata + ['user_id' => $userId]);
    }

    /** Solde disponible (unités mineures) du portefeuille d'un utilisateur. */
    public function balance(int $userId): int
    {
        return LedgerAccount::forUser($userId)->balance;
    }

    /** @param array<int, array{direction:string, amount:int}> $legs */
    private function assertBalanced(array $legs): void
    {
        if (count($legs) < 2) {
            throw new \InvalidArgumentException('Une transaction en partie double requiert au moins deux écritures.');
        }
        $debit = 0;
        $credit = 0;
        foreach ($legs as $leg) {
            if ($leg['direction'] === 'debit') {
                $debit += (int) $leg['amount'];
            } elseif ($leg['direction'] === 'credit') {
                $credit += (int) $leg['amount'];
            } else {
                throw new \InvalidArgumentException('Direction d\'écriture invalide : ' . $leg['direction']);
            }
        }
        if ($debit !== $credit) {
            throw new \InvalidArgumentException(
                "Transaction déséquilibrée : débits ($debit) ≠ crédits ($credit)."
            );
        }
    }
}

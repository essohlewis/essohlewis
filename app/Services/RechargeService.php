<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Config;
use Transouscris\Core\Database;
use Transouscris\Core\Exceptions\InsufficientFundsException;
use Transouscris\Models\LedgerAccount;
use Transouscris\Models\Plan;
use Transouscris\Models\Recharge;

/**
 * Orchestration d'une recharge payée depuis le portefeuille utilisateur.
 *
 * Séquence :
 *   1. Ouvre l'ordre de recharge (statut pending, échéance de garantie posée).
 *   2. Débit ATOMIQUE du wallet → compte de séquestre opérateur (partie double,
 *      verrou pessimiste, solde vérifié) via WalletService.
 *   3. Dispatch vers l'opérateur. La confirmation (webhook opérateur) fera
 *      passer la recharge à `success` et transférera le séquestre → revenus.
 *   4. En cas de solde insuffisant, aucune écriture n'est faite (rollback).
 */
final class RechargeService
{
    public function __construct(
        private WalletService $wallet = new WalletService(),
        private OperatorDispatcher $dispatcher = new OperatorDispatcher(),
        private AuditLogger $audit = new AuditLogger()
    ) {}

    /**
     * @throws InsufficientFundsException
     */
    public function rechargeFromWallet(int $userId, string $operatorCode, string $msisdn, int $amount, string $type = 'credit', ?int $planId = null): Recharge
    {
        $guaranteeDelay = (int) Config::get('recharge.guarantee_delay', 900);

        if ($planId !== null) {
            $plan = Plan::find($planId);
            if ($plan === null || $plan->operatorCode !== $operatorCode) {
                throw new \InvalidArgumentException('Forfait invalide pour cet opérateur.');
            }
            $amount = $plan->price;
            $type   = $plan->category;
        }

        return Database::transaction(function () use ($userId, $operatorCode, $msisdn, $amount, $type, $planId, $guaranteeDelay) {
            $recharge = Recharge::open($userId, $operatorCode, $msisdn, $amount, $type, $planId, $guaranteeDelay);

            // Débit wallet → séquestre opérateur. Référence idempotente = l'ordre.
            $ledgerTxnId = $this->wallet->debit(
                userId: $userId,
                amount: $amount,
                reference: 'recharge:' . $recharge->id,
                type: 'recharge',
                destCode: 'OPERATOR_SETTLEMENT',
                metadata: ['recharge_id' => $recharge->id, 'msisdn' => $msisdn, 'operator' => $operatorCode]
            );
            $recharge->linkLedger($ledgerTxnId);

            // Dispatch opérateur (hors argent : simple ordre technique).
            $result = $this->dispatcher->dispatch($operatorCode, $msisdn, $amount, $type, $planId ? (string) $planId : null);
            $recharge->setStatus($result['accepted'] ? 'dispatched' : 'failed', $result['operator_ref']);

            $this->audit->log('recharge.create', 'recharge', $recharge->id, [
                'operator' => $operatorCode, 'msisdn' => $msisdn, 'amount' => $amount,
            ], $userId);

            // Notification transactionnelle.
            $verb = $type === 'transfer' ? 'Transfert' : ($type === 'credit' ? 'Recharge' : 'Forfait');
            \Transouscris\Models\Notification::push(
                $userId,
                'transaction',
                "$verb de " . number_format($amount, 0, ',', ' ') . ' F vers ' . $msisdn,
                'Opération enregistrée (' . strtoupper($operatorCode) . ').',
                '/recharge/' . $recharge->id . '/receipt'
            );

            return $recharge;
        });
    }

    /**
     * Confirme une recharge (appelé par le webhook opérateur). Transfère le
     * montant du séquestre vers les revenus plateforme et clôt l'ordre.
     */
    public function confirmSuccess(Recharge $recharge, ?string $operatorRef = null): void
    {
        if ($recharge->status === 'success') {
            return; // idempotent
        }
        Database::transaction(function () use ($recharge, $operatorRef) {
            $settlement = LedgerAccount::system('OPERATOR_SETTLEMENT');
            $revenue    = LedgerAccount::system('PLATFORM_REVENUE');

            $this->wallet->post(
                reference: 'recharge:settle:' . $recharge->id,
                type: 'recharge_settlement',
                legs: [
                    ['account_id' => $settlement->id, 'direction' => 'debit',  'amount' => $recharge->amount],
                    ['account_id' => $revenue->id,    'direction' => 'credit', 'amount' => $recharge->amount],
                ],
                metadata: ['recharge_id' => $recharge->id]
            );
            $recharge->setStatus('success', $operatorRef);
            $this->audit->log('recharge.success', 'recharge', $recharge->id, ['operator_ref' => $operatorRef]);
        });
    }
}

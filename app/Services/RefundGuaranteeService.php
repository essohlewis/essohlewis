<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Database;
use Transouscris\Models\LedgerAccount;
use Transouscris\Models\Recharge;

/**
 * Garantie de remboursement automatique (fonctionnalité différenciante).
 *
 * Passé le délai de garantie (ex. 15 min) sans confirmation opérateur, la
 * recharge est remboursée : le montant retourne du séquestre opérateur vers le
 * portefeuille de l'utilisateur, et la recharge passe au statut `refunded`.
 *
 * À invoquer périodiquement (cron / worker) : voir bin/guarantee-worker.php.
 */
final class RefundGuaranteeService
{
    public function __construct(
        private WalletService $wallet = new WalletService(),
        private AuditLogger $audit = new AuditLogger()
    ) {}

    /** @return int nombre de recharges remboursées */
    public function processOverdue(): int
    {
        $count = 0;
        foreach (Recharge::overdueForGuarantee() as $recharge) {
            $this->refund($recharge);
            $count++;
        }
        return $count;
    }

    public function refund(Recharge $recharge): void
    {
        if (in_array($recharge->status, ['success', 'refunded'], true)) {
            return; // rien à rembourser
        }

        Database::transaction(function () use ($recharge) {
            $settlement = LedgerAccount::system('OPERATOR_SETTLEMENT');
            $wallet     = LedgerAccount::forUser($recharge->userId);

            // Rembourse : séquestre opérateur → portefeuille utilisateur.
            $this->wallet->post(
                reference: 'recharge:refund:' . $recharge->id,
                type: 'recharge_refund',
                legs: [
                    ['account_id' => $settlement->id, 'direction' => 'debit',  'amount' => $recharge->amount],
                    ['account_id' => $wallet->id,     'direction' => 'credit', 'amount' => $recharge->amount],
                ],
                metadata: ['recharge_id' => $recharge->id, 'reason' => 'guarantee_timeout']
            );
            $recharge->setStatus('refunded');
            $this->audit->log('recharge.refund', 'recharge', $recharge->id, [
                'reason' => 'guarantee_timeout', 'amount' => $recharge->amount,
            ], $recharge->userId);
        });
    }
}

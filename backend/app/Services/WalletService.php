<?php

namespace App\Services;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WalletService
{
    /**
     * Post a signed amount to a wallet as a single ledger line.
     *
     * Guarantees:
     *  - Idempotent on $reference: replaying the same reference returns the existing
     *    line and never double-posts (critical for Mobile Money webhook retries).
     *  - Atomic: the balance mutation and ledger write happen under a row lock.
     *  - The wallet balance is always the ledger sum; `balance_after_cents` snapshots it.
     *
     * @param  int  $amountCents  Positive to credit, negative to debit.
     */
    public function post(
        Wallet $wallet,
        TransactionType $type,
        int $amountCents,
        string $reference,
        ?Model $related = null,
        TransactionStatus $status = TransactionStatus::Completed,
        array $meta = [],
    ): WalletTransaction {
        // Fast idempotency check outside the transaction.
        $existing = WalletTransaction::where('reference', $reference)->first();
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($wallet, $type, $amountCents, $reference, $related, $status, $meta) {
            // Re-check inside the lock to close the race window.
            $existing = WalletTransaction::where('reference', $reference)->lockForUpdate()->first();
            if ($existing) {
                return $existing;
            }

            /** @var Wallet $locked */
            $locked = Wallet::whereKey($wallet->getKey())->lockForUpdate()->firstOrFail();

            $newBalance = $locked->balance_cents + $amountCents;

            if ($newBalance < 0) {
                throw new RuntimeException('Insufficient wallet balance.');
            }

            $tx = new WalletTransaction([
                'type' => $type,
                'amount_cents' => $amountCents,
                'balance_after_cents' => $newBalance,
                'reference' => $reference,
                'status' => $status,
                'meta' => $meta ?: null,
            ]);
            $tx->wallet()->associate($locked);
            if ($related) {
                $tx->related()->associate($related);
            }
            $tx->save();

            // Only a completed line moves the running balance.
            if ($status === TransactionStatus::Completed) {
                $locked->balance_cents = $newBalance;
                $locked->version = $locked->version + 1;
                $locked->save();
            }

            $wallet->refresh();

            return $tx;
        });
    }

    public function credit(Wallet $wallet, TransactionType $type, int $amountCents, string $reference, ?Model $related = null, array $meta = []): WalletTransaction
    {
        return $this->post($wallet, $type, abs($amountCents), $reference, $related, TransactionStatus::Completed, $meta);
    }

    public function debit(Wallet $wallet, TransactionType $type, int $amountCents, string $reference, ?Model $related = null, array $meta = []): WalletTransaction
    {
        return $this->post($wallet, $type, -abs($amountCents), $reference, $related, TransactionStatus::Completed, $meta);
    }

    /**
     * Record a pending top-up (Mobile Money collection requested but not yet confirmed).
     * Does not move the balance. Idempotent on $reference (the provider reference).
     */
    public function initiateTopup(Wallet $wallet, int $amountCents, string $reference, array $meta = []): WalletTransaction
    {
        return $this->post(
            $wallet,
            TransactionType::Topup,
            abs($amountCents),
            $reference,
            null,
            TransactionStatus::Pending,
            $meta,
        );
    }

    /**
     * Confirm a previously-initiated top-up from a provider webhook. Idempotent:
     * a replayed webhook for an already-completed reference is a no-op.
     *
     * @return bool True if this call transitioned the top-up to completed.
     */
    public function completeTopup(string $reference): bool
    {
        return DB::transaction(function () use ($reference) {
            $tx = WalletTransaction::where('reference', $reference)->lockForUpdate()->first();

            if (! $tx || $tx->status !== TransactionStatus::Pending) {
                return false; // unknown or already settled/failed
            }

            /** @var Wallet $wallet */
            $wallet = Wallet::whereKey($tx->wallet_id)->lockForUpdate()->firstOrFail();
            $wallet->balance_cents += $tx->amount_cents;
            $wallet->version += 1;
            $wallet->save();

            $tx->status = TransactionStatus::Completed;
            $tx->balance_after_cents = $wallet->balance_cents;
            $tx->save();

            return true;
        });
    }

    /** Mark a pending top-up as failed. Idempotent. */
    public function failTopup(string $reference): bool
    {
        return DB::transaction(function () use ($reference) {
            $tx = WalletTransaction::where('reference', $reference)->lockForUpdate()->first();
            if (! $tx || $tx->status !== TransactionStatus::Pending) {
                return false;
            }
            $tx->status = TransactionStatus::Failed;
            $tx->save();

            return true;
        });
    }
}

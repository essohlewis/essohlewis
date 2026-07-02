<?php

namespace App\Services;

use App\Enums\TransactionType;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class SubscriptionService
{
    /** Platform commission retained on each subscription payment. */
    public const COMMISSION_RATE = 0.20;

    private const PERIOD_DAYS = 30;

    public function __construct(private WalletService $wallet)
    {
    }

    /**
     * Subscribe a consumer to a tipster for one period, paid from the consumer's
     * prepaid wallet. Money flow, in one atomic ledger sequence:
     *   consumer wallet  -price
     *   tipster wallet   +price*(1-commission)
     *   (commission stays on the platform ledger implicitly)
     */
    public function subscribe(User $consumer, User $tipster, int $priceCents): Subscription
    {
        if (! $tipster->isApprovedTipster()) {
            throw new RuntimeException('Tipster is not available for subscription.');
        }
        if ($consumer->is($tipster)) {
            throw new RuntimeException('You cannot subscribe to yourself.');
        }

        return DB::transaction(function () use ($consumer, $tipster, $priceCents) {
            $consumerWallet = $consumer->wallet()->firstOrFail();
            $tipsterWallet = $tipster->wallet()->firstOrFail();

            $ref = 'sub_'.Str::uuid()->toString();
            $now = Carbon::now();

            $subscription = Subscription::create([
                'consumer_id' => $consumer->id,
                'tipster_id' => $tipster->id,
                'price_cents' => $priceCents,
                'period_start' => $now,
                'period_end' => $now->copy()->addDays(self::PERIOD_DAYS),
                'status' => \App\Enums\SubscriptionStatus::Active,
                'auto_renew' => true,
            ]);

            // Debit consumer (throws if balance insufficient).
            $this->wallet->debit(
                $consumerWallet,
                TransactionType::SubscriptionDebit,
                $priceCents,
                $ref.'_debit',
                $subscription,
            );

            // Credit tipster net of commission.
            $tipsterShare = (int) round($priceCents * (1 - self::COMMISSION_RATE));
            $this->wallet->credit(
                $tipsterWallet,
                TransactionType::SubscriptionCredit,
                $tipsterShare,
                $ref.'_credit',
                $subscription,
                ['commission_cents' => $priceCents - $tipsterShare],
            );

            return $subscription;
        });
    }

    /**
     * Whether a consumer currently has paid access to a tipster's subscriber content.
     */
    public function hasActiveAccess(User $consumer, int $tipsterId): bool
    {
        return $consumer->subscriptions()
            ->where('tipster_id', $tipsterId)
            ->where('status', \App\Enums\SubscriptionStatus::Active)
            ->where('period_end', '>', Carbon::now())
            ->exists();
    }
}

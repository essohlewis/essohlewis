<?php

namespace Tests\Feature;

use App\Enums\TransactionType;
use App\Models\User;
use App\Models\Wallet;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_replayed_reference_does_not_double_post(): void
    {
        $user = User::create(['phone' => '+2250700000011']);
        $wallet = Wallet::create(['user_id' => $user->id]);
        $service = app(WalletService::class);

        $service->credit($wallet, TransactionType::Topup, 100000, 'ref-abc');
        $service->credit($wallet, TransactionType::Topup, 100000, 'ref-abc'); // replay

        $this->assertSame(100000, $wallet->fresh()->balance_cents);
        $this->assertDatabaseCount('wallet_transactions', 1);
    }

    public function test_pending_topup_completes_once(): void
    {
        $user = User::create(['phone' => '+2250700000012']);
        $wallet = Wallet::create(['user_id' => $user->id]);
        $service = app(WalletService::class);

        $service->initiateTopup($wallet, 500000, 'momo-xyz');
        $this->assertSame(0, $wallet->fresh()->balance_cents); // not moved yet

        $this->assertTrue($service->completeTopup('momo-xyz'));
        $this->assertFalse($service->completeTopup('momo-xyz')); // replay is a no-op

        $this->assertSame(500000, $wallet->fresh()->balance_cents);
    }

    public function test_debit_cannot_go_negative(): void
    {
        $user = User::create(['phone' => '+2250700000013']);
        $wallet = Wallet::create(['user_id' => $user->id, 'balance_cents' => 10000]);
        $service = app(WalletService::class);

        $this->expectException(\RuntimeException::class);
        $service->debit($wallet, TransactionType::SubscriptionDebit, 50000, 'over-debit');
    }
}

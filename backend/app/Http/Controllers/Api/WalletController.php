<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use App\Services\MobileMoney\MobileMoneyProvider;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function __construct(
        private WalletService $wallet,
        private MobileMoneyProvider $momo,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $wallet = $request->user()->wallet()->firstOrCreate([]);

        $transactions = $wallet->transactions()->latest('id')->limit(50)->get()->map(fn ($t) => [
            'id' => $t->id,
            'type' => $t->type,
            'amount_cents' => $t->amount_cents,
            'balance_after_cents' => $t->balance_after_cents,
            'status' => $t->status,
            'created_at' => $t->created_at,
        ]);

        return response()->json([
            'balance_cents' => $wallet->balance_cents,
            'currency' => $wallet->currency,
            'transactions' => $transactions,
        ]);
    }

    /**
     * Initiate a Mobile Money top-up. Returns a pending reference; the balance is
     * credited only when the signed provider webhook confirms the collection.
     */
    public function topup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount_cents' => ['required', 'integer', 'min:10000'], // >= 100 XOF
        ]);

        $user = $request->user();
        /** @var Wallet $wallet */
        $wallet = $user->wallet()->firstOrCreate([]);

        $idempotencyKey = 'topup_'.Str::uuid()->toString();
        $result = $this->momo->requestCollection(
            $user->phone,
            $data['amount_cents'],
            $wallet->currency,
            $idempotencyKey,
        );

        $this->wallet->initiateTopup(
            $wallet,
            $data['amount_cents'],
            $result->providerReference,
            ['idempotency_key' => $idempotencyKey],
        );

        return response()->json([
            'status' => $result->status,
            'provider_reference' => $result->providerReference,
            'message' => 'Confirm the collection on your phone.',
        ], 202);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Enums\FixtureStatus;
use App\Http\Controllers\Controller;
use App\Models\Fixture;
use App\Services\MobileMoney\MobileMoneyProvider;
use App\Services\SettlementService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function __construct(
        private WalletService $wallet,
        private SettlementService $settlement,
        private MobileMoneyProvider $momo,
    ) {
    }

    /**
     * Mobile Money collection callback. Signature-verified, idempotent.
     * Body: { "provider_reference": "...", "status": "completed|failed" }
     */
    public function mobileMoney(Request $request): JsonResponse
    {
        $signature = (string) $request->header('X-Signature', '');
        if (! $this->momo->verifyWebhookSignature($request->getContent(), $signature)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $reference = (string) $request->input('provider_reference');
        $status = (string) $request->input('status');

        if ($status === 'completed') {
            $this->wallet->completeTopup($reference);
        } elseif ($status === 'failed') {
            $this->wallet->failTopup($reference);
        }

        return response()->json(['message' => 'ok']);
    }

    /**
     * Sports results callback. Signature-verified against the results secret.
     * Body: { "external_ref": "...", "result": {"home": 2, "away": 1} }
     *   or  { "external_ref": "...", "status": "postponed|cancelled" }
     */
    public function results(Request $request): JsonResponse
    {
        $signature = (string) $request->header('X-Signature', '');
        $expected = hash_hmac('sha256', $request->getContent(), config('momo.results_webhook_secret'));
        if (! hash_equals($expected, $signature)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $fixture = Fixture::where('external_ref', $request->input('external_ref'))->first();
        if (! $fixture) {
            return response()->json(['message' => 'Unknown fixture.'], 404);
        }

        $status = $request->input('status');
        if (in_array($status, ['postponed', 'cancelled'], true)) {
            $this->settlement->void(
                $fixture,
                $status === 'cancelled' ? FixtureStatus::Cancelled : FixtureStatus::Postponed,
            );

            return response()->json(['message' => 'voided']);
        }

        $result = $request->input('result');
        if (! is_array($result) || ! isset($result['home'], $result['away'])) {
            return response()->json(['message' => 'Invalid result payload.'], 422);
        }

        $this->settlement->settle($fixture, [
            'home' => (int) $result['home'],
            'away' => (int) $result['away'],
        ]);

        return response()->json(['message' => 'settled']);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $subs = $request->user()->subscriptions()
            ->with('tipster')
            ->latest('id')
            ->get()
            ->map(fn (Subscription $s) => [
                'id' => $s->id,
                'tipster' => [
                    'id' => $s->tipster->id,
                    'display_name' => $s->tipster->display_name,
                ],
                'status' => $s->status,
                'auto_renew' => $s->auto_renew,
                'period_end' => $s->period_end,
                'price_cents' => $s->price_cents,
            ]);

        return response()->json(['data' => $subs]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tipster_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $tipster = User::findOrFail($data['tipster_id']);
        $price = (int) config('momo.default_subscription_price_cents');

        try {
            $subscription = $this->subscriptions->subscribe($request->user(), $tipster, $price);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'id' => $subscription->id,
            'status' => $subscription->status,
            'period_end' => $subscription->period_end,
        ], 201);
    }

    /**
     * Cancel auto-renew. Access is kept until the paid period ends.
     */
    public function destroy(Request $request, Subscription $subscription): JsonResponse
    {
        abort_unless($subscription->consumer_id === $request->user()->id, 403);

        $subscription->update(['auto_renew' => false]);

        return response()->json([
            'message' => 'Auto-renew cancelled. Access remains until period end.',
            'period_end' => $subscription->period_end,
            'status' => SubscriptionStatus::Active,
        ]);
    }
}

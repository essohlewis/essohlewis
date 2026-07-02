<?php

namespace App\Http\Controllers\Api;

use App\Enums\TipsterStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PredictionResource;
use App\Models\Prediction;
use App\Models\ReliabilitySnapshot;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipsterController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    /**
     * Public leaderboard of approved tipsters, ranked by their latest reliability score.
     */
    public function index(Request $request): JsonResponse
    {
        // Latest snapshot per tipster via a correlated max(id).
        $latestIds = ReliabilitySnapshot::selectRaw('MAX(id) as id')
            ->groupBy('tipster_id')
            ->pluck('id');

        $snapshots = ReliabilitySnapshot::whereIn('id', $latestIds)
            ->with('tipster')
            ->get()
            ->filter(fn ($s) => $s->tipster && $s->tipster->tipster_status === TipsterStatus::Approved)
            ->sortByDesc('score')
            ->values();

        return response()->json([
            'data' => $snapshots->map(fn (ReliabilitySnapshot $s) => [
                'tipster' => $this->tipsterCard($s->tipster),
                'settled_count' => $s->settled_count,
                'win_rate' => (float) $s->win_rate,
                'yield' => (float) $s->yield,
                'score' => (float) $s->score,
                'badge' => $s->badge,
            ]),
        ]);
    }

    public function show(User $tipster): JsonResponse
    {
        abort_unless($tipster->tipster_status === TipsterStatus::Approved, 404);

        $snapshot = $tipster->latestReliability();

        return response()->json([
            'tipster' => $this->tipsterCard($tipster),
            'reliability' => $snapshot ? [
                'settled_count' => $snapshot->settled_count,
                'win_rate' => (float) $snapshot->win_rate,
                'yield' => (float) $snapshot->yield,
                'score' => (float) $snapshot->score,
                'badge' => $snapshot->badge,
            ] : null,
        ]);
    }

    /**
     * A tipster's picks. Subscriber-only picks are masked unless the requester is
     * the tipster or an active subscriber.
     */
    public function predictions(Request $request, User $tipster): JsonResponse
    {
        abort_unless($tipster->tipster_status === TipsterStatus::Approved, 404);

        $viewer = $request->user();
        $hasAccess = $viewer
            && ($viewer->is($tipster) || $this->subscriptions->hasActiveAccess($viewer, $tipster->id));

        $predictions = Prediction::where('tipster_id', $tipster->id)
            ->with('fixture.homeTeam', 'fixture.awayTeam')
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $predictions->getCollection()->map(
                fn (Prediction $p) => PredictionResource::make($p)->withAccess($hasAccess)->resolve()
            ),
            'meta' => [
                'current_page' => $predictions->currentPage(),
                'last_page' => $predictions->lastPage(),
                'total' => $predictions->total(),
            ],
        ]);
    }

    /**
     * Apply to become a tipster (moves status to pending for review).
     */
    public function apply(Request $request): JsonResponse
    {
        $data = $request->validate([
            'display_name' => ['required', 'string', 'max:60'],
            'bio' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        abort_if($user->tipster_status === TipsterStatus::Approved, 422, 'Already a tipster.');

        $user->forceFill([
            'display_name' => $data['display_name'],
            'bio' => $data['bio'] ?? null,
            'tipster_status' => TipsterStatus::Pending,
        ])->save();

        return response()->json([
            'message' => 'Application submitted.',
            'tipster_status' => $user->tipster_status,
        ]);
    }

    private function tipsterCard(User $tipster): array
    {
        return [
            'id' => $tipster->id,
            'display_name' => $tipster->display_name,
            'bio' => $tipster->bio,
            'country_code' => $tipster->country_code,
        ];
    }
}

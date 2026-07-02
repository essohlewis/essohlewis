<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePredictionRequest;
use App\Http\Resources\PredictionResource;
use App\Models\Fixture;
use App\Models\Prediction;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PredictionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    /**
     * Publish a prediction. The core integrity rule lives here: a pick can only be
     * created before kickoff, and `locked_at` is stamped from the server clock. There
     * is intentionally no update/destroy action — the track record is append-only.
     */
    public function store(StorePredictionRequest $request): JsonResponse
    {
        $user = $request->user();
        $fixture = Fixture::findOrFail($request->integer('fixture_id'));

        abort_unless($fixture->isOpenForPredictions(), 422, 'Fixture is closed for predictions.');

        $prediction = Prediction::create([
            'tipster_id' => $user->id,
            'fixture_id' => $fixture->id,
            'market' => $request->enum('market', \App\Enums\Market::class),
            'selection' => $request->string('selection'),
            'odds' => $request->float('odds'),
            'stake_units' => $request->float('stake_units', 1.0),
            'confidence' => $request->integer('confidence', 3),
            'visibility' => $request->enum('visibility', \App\Enums\Visibility::class),
            'analysis' => $request->input('analysis'),
            // Server clock only — never trust a client timestamp here.
            'locked_at' => Carbon::now(),
        ]);

        return response()->json(
            PredictionResource::make($prediction->load('fixture.homeTeam', 'fixture.awayTeam'))
                ->withAccess(true)
                ->resolve(),
            201,
        );
    }

    public function show(Request $request, Prediction $prediction): JsonResponse
    {
        $viewer = $request->user();
        $hasAccess = $viewer && (
            $viewer->id === $prediction->tipster_id
            || $this->subscriptions->hasActiveAccess($viewer, $prediction->tipster_id)
        );

        return response()->json(
            PredictionResource::make($prediction->load('fixture.homeTeam', 'fixture.awayTeam'))
                ->withAccess($hasAccess)
                ->resolve()
        );
    }
}

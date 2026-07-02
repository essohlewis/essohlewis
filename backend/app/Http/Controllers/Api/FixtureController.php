<?php

namespace App\Http\Controllers\Api;

use App\Enums\FixtureStatus;
use App\Http\Controllers\Controller;
use App\Models\Fixture;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class FixtureController extends Controller
{
    /**
     * Upcoming fixtures still open for predictions.
     */
    public function index(Request $request): JsonResponse
    {
        $fixtures = Fixture::query()
            ->where('status', FixtureStatus::Scheduled)
            ->where('kickoff_at', '>', Carbon::now())
            ->with(['homeTeam', 'awayTeam', 'competition'])
            ->orderBy('kickoff_at')
            ->paginate(30);

        return response()->json([
            'data' => $fixtures->getCollection()->map(fn (Fixture $f) => [
                'id' => $f->id,
                'competition' => $f->competition?->name,
                'home' => $f->homeTeam?->name,
                'away' => $f->awayTeam?->name,
                'kickoff_at' => $f->kickoff_at,
                'status' => $f->status,
            ]),
            'meta' => [
                'current_page' => $fixtures->currentPage(),
                'last_page' => $fixtures->lastPage(),
                'total' => $fixtures->total(),
            ],
        ]);
    }
}

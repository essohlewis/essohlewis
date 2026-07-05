<?php

namespace App\Services;

use App\Enums\FixtureStatus;
use App\Enums\Market;
use App\Enums\PredictionOutcome;
use App\Models\Fixture;
use App\Models\Prediction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SettlementService
{
    public function __construct(private ReliabilityService $reliability)
    {
    }

    /**
     * Settle a fixture from a normalised result payload ['home' => int, 'away' => int].
     * Idempotent: predictions already settled are skipped. Recomputes reliability
     * for every affected tipster afterwards.
     */
    public function settle(Fixture $fixture, array $result): void
    {
        $affectedTipsters = DB::transaction(function () use ($fixture, $result) {
            $fixture->forceFill([
                'result' => $result,
                'status' => FixtureStatus::Finished,
                'settled_at' => Carbon::now(),
            ])->save();

            $tipsters = [];

            $fixture->predictions()->whereNull('outcome')->cursor()->each(function (Prediction $p) use ($result, &$tipsters) {
                $outcome = $this->resolveOutcome($p, $result);
                $p->forceFill([
                    'outcome' => $outcome,
                    'settled_at' => Carbon::now(),
                ])->save();
                $tipsters[$p->tipster_id] = true;
            });

            return array_keys($tipsters);
        });

        foreach ($affectedTipsters as $tipsterId) {
            $this->reliability->recompute($tipsterId);
        }
    }

    /**
     * Mark a fixture void (postponed/cancelled): every open prediction is voided,
     * so stakes are conceptually returned and the pick is excluded from the record.
     */
    public function void(Fixture $fixture, FixtureStatus $status = FixtureStatus::Postponed): void
    {
        DB::transaction(function () use ($fixture, $status) {
            $fixture->forceFill(['status' => $status, 'settled_at' => Carbon::now()])->save();
            $fixture->predictions()->whereNull('outcome')->update([
                'outcome' => PredictionOutcome::Void->value,
                'settled_at' => Carbon::now(),
            ]);
        });
    }

    private function resolveOutcome(Prediction $p, array $result): PredictionOutcome
    {
        $home = (int) ($result['home'] ?? 0);
        $away = (int) ($result['away'] ?? 0);

        return match ($p->market) {
            Market::Result1x2 => $this->resolve1x2($p->selection, $home, $away),
            Market::OverUnder => $this->resolveOverUnder($p->selection, $home + $away),
            Market::Btts => $this->resolveBtts($p->selection, $home, $away),
            // Handicap and anything unmapped is voided rather than mis-scored.
            default => PredictionOutcome::Void,
        };
    }

    private function resolve1x2(string $selection, int $home, int $away): PredictionOutcome
    {
        $actual = $home <=> $away; // 1 home, 0 draw, -1 away
        $picked = match ($selection) {
            'home' => 1,
            'draw' => 0,
            'away' => -1,
            default => null,
        };

        if ($picked === null) {
            return PredictionOutcome::Void;
        }

        return $picked === $actual ? PredictionOutcome::Won : PredictionOutcome::Lost;
    }

    private function resolveOverUnder(string $selection, int $totalGoals): PredictionOutcome
    {
        // selection like "over_2.5" / "under_2.5"
        if (! preg_match('/^(over|under)_([0-9]+(?:\.[0-9]+)?)$/', $selection, $m)) {
            return PredictionOutcome::Void;
        }

        $side = $m[1];
        $line = (float) $m[2];
        $isOver = $totalGoals > $line;

        $won = ($side === 'over' && $isOver) || ($side === 'under' && ! $isOver);

        return $won ? PredictionOutcome::Won : PredictionOutcome::Lost;
    }

    private function resolveBtts(string $selection, int $home, int $away): PredictionOutcome
    {
        $bothScored = $home > 0 && $away > 0;
        $picked = match ($selection) {
            'yes' => true,
            'no' => false,
            default => null,
        };

        if ($picked === null) {
            return PredictionOutcome::Void;
        }

        return $picked === $bothScored ? PredictionOutcome::Won : PredictionOutcome::Lost;
    }
}

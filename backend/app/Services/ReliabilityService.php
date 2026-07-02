<?php

namespace App\Services;

use App\Models\Prediction;
use App\Models\ReliabilitySnapshot;
use Illuminate\Support\Carbon;

class ReliabilityService
{
    /** Minimum settled picks before a score is shown (anti "lucky streak"). */
    public const MIN_VOLUME = 30;

    /** Recency half-life in days: an old pick counts for less. */
    private const HALF_LIFE_DAYS = 90.0;

    /**
     * Recompute a tipster's reliability from their settled, record-counting picks
     * and append a snapshot. History is never overwritten.
     */
    public function recompute(int $tipsterId): ReliabilitySnapshot
    {
        $picks = Prediction::where('tipster_id', $tipsterId)
            ->whereNotNull('outcome')
            ->get();

        $counting = $picks->filter(fn (Prediction $p) => $p->outcome->countsForRecord());
        $settledCount = $counting->count();

        $wins = 0;
        $weightedProfit = 0.0;   // recency-weighted net units
        $weightedStake = 0.0;
        $rawProfit = 0.0;
        $rawStake = 0.0;
        $now = Carbon::now();

        foreach ($counting as $p) {
            $odds = (float) $p->odds;
            $stake = (float) $p->stake_units;
            $factor = $p->outcome->profitFactor($odds);       // net units per 1 unit staked
            $profit = $factor * $stake;

            $ageDays = $now->diffInDays($p->settled_at ?? $p->created_at);
            $weight = 2 ** (-$ageDays / self::HALF_LIFE_DAYS);

            $rawProfit += $profit;
            $rawStake += $stake;
            $weightedProfit += $profit * $weight;
            $weightedStake += $stake * $weight;

            if (in_array($p->outcome->value, ['won', 'half_won'], true)) {
                $wins++;
            }
        }

        $winRate = $settledCount > 0 ? round($wins / $settledCount * 100, 2) : 0.0;
        $yield = $rawStake > 0 ? round($rawProfit / $rawStake * 100, 2) : 0.0;
        $weightedYield = $weightedStake > 0 ? $weightedProfit / $weightedStake * 100 : 0.0;

        $score = $this->compositeScore($settledCount, $weightedYield);
        $badge = $this->badge($settledCount, $score);

        return ReliabilitySnapshot::create([
            'tipster_id' => $tipsterId,
            'settled_count' => $settledCount,
            'win_rate' => $winRate,
            'yield' => $yield,
            'score' => $score,
            'badge' => $badge,
        ]);
    }

    /**
     * Map a recency-weighted yield to a bounded 0-100 score, damped by volume so a
     * small sample cannot post an extreme score. Yield is the reigning metric: it
     * rewards value found, not volume of near-certain low-odds picks.
     */
    private function compositeScore(int $volume, float $weightedYield): float
    {
        if ($volume < self::MIN_VOLUME) {
            return 0.0;
        }

        // Center 0% yield at 50; +/-30% yield saturates near the bounds.
        $base = 50.0 + ($weightedYield / 30.0) * 50.0;
        $base = max(0.0, min(100.0, $base));

        // Volume confidence ramp: full weight around ~130 settled picks.
        $confidence = min(1.0, $volume / (self::MIN_VOLUME + 100));

        return round(50.0 + ($base - 50.0) * $confidence, 2);
    }

    private function badge(int $volume, float $score): string
    {
        if ($volume < self::MIN_VOLUME) {
            return 'unrated';
        }

        return match (true) {
            $score >= 70 => 'gold',
            $score >= 60 => 'silver',
            $score >= 52 => 'bronze',
            default => 'unrated',
        };
    }
}

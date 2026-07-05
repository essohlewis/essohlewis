<?php

namespace App\Enums;

enum PredictionOutcome: string
{
    case Won = 'won';
    case Lost = 'lost';
    case Void = 'void';
    case HalfWon = 'half_won';
    case HalfLost = 'half_lost';

    /**
     * Net profit in stake units for a 1-unit stake at the given odds.
     * Void returns the stake (net 0). Half outcomes settle half the stake.
     */
    public function profitFactor(float $odds): float
    {
        return match ($this) {
            self::Won => $odds - 1.0,
            self::Lost => -1.0,
            self::Void => 0.0,
            self::HalfWon => ($odds - 1.0) / 2.0,
            self::HalfLost => -0.5,
        };
    }

    public function countsForRecord(): bool
    {
        return $this !== self::Void;
    }
}

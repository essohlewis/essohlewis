<?php

namespace App\Models;

use App\Enums\Market;
use App\Enums\PredictionOutcome;
use App\Enums\Visibility;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable after creation. Do not add update/delete flows for this model — the
 * tipster track record must never be rewritable. Only the settlement service may
 * fill `outcome`/`settled_at`, exactly once, via the guarded settle path.
 */
class Prediction extends Model
{
    protected $fillable = [
        'tipster_id',
        'fixture_id',
        'market',
        'selection',
        'odds',
        'stake_units',
        'confidence',
        'visibility',
        'analysis',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'odds' => 'decimal:2',
            'stake_units' => 'decimal:2',
            'confidence' => 'integer',
            'locked_at' => 'datetime',
            'settled_at' => 'datetime',
            'market' => Market::class,
            'visibility' => Visibility::class,
            'outcome' => PredictionOutcome::class,
        ];
    }

    public function tipster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tipster_id');
    }

    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }

    public function isSettled(): bool
    {
        return $this->outcome !== null;
    }
}

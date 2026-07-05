<?php

namespace App\Models;

use App\Enums\FixtureStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fixture extends Model
{
    protected $fillable = [
        'competition_id',
        'home_team_id',
        'away_team_id',
        'external_ref',
        'kickoff_at',
        'status',
        'result',
        'settled_at',
    ];

    protected function casts(): array
    {
        return [
            'kickoff_at' => 'datetime',
            'settled_at' => 'datetime',
            'result' => 'array',
            'status' => FixtureStatus::class,
        ];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }

    public function homeTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'home_team_id');
    }

    public function awayTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'away_team_id');
    }

    public function predictions(): HasMany
    {
        return $this->hasMany(Prediction::class);
    }

    public function isOpenForPredictions(): bool
    {
        return $this->status === FixtureStatus::Scheduled
            && $this->kickoff_at->isFuture();
    }
}

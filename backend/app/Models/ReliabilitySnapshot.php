<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReliabilitySnapshot extends Model
{
    protected $fillable = [
        'tipster_id',
        'settled_count',
        'win_rate',
        'yield',
        'score',
        'badge',
    ];

    protected function casts(): array
    {
        return [
            'settled_count' => 'integer',
            'win_rate' => 'decimal:2',
            'yield' => 'decimal:2',
            'score' => 'decimal:2',
        ];
    }

    public function tipster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tipster_id');
    }
}

<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'consumer_id',
        'tipster_id',
        'price_cents',
        'period_start',
        'period_end',
        'status',
        'auto_renew',
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'auto_renew' => 'boolean',
            'status' => SubscriptionStatus::class,
        ];
    }

    public function consumer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consumer_id');
    }

    public function tipster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tipster_id');
    }

    public function isActiveNow(): bool
    {
        return $this->status === SubscriptionStatus::Active
            && $this->period_end->isFuture();
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Team extends Model
{
    protected $fillable = ['sport_id', 'name', 'short_name', 'external_ref'];

    public function sport(): BelongsTo
    {
        return $this->belongsTo(Sport::class);
    }
}

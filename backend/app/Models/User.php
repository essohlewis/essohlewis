<?php

namespace App\Models;

use App\Enums\KycStatus;
use App\Enums\TipsterStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'password',
        'country_code',
        'role_flags',
        'tipster_status',
        'kyc_status',
        'display_name',
        'bio',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'phone_verified_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role_flags' => 'array',
            'tipster_status' => TipsterStatus::class,
            'kyc_status' => KycStatus::class,
        ];
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function predictions(): HasMany
    {
        return $this->hasMany(Prediction::class, 'tipster_id');
    }

    public function reliabilitySnapshots(): HasMany
    {
        return $this->hasMany(ReliabilitySnapshot::class, 'tipster_id');
    }

    /** Subscriptions where this user is the paying consumer. */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'consumer_id');
    }

    /** Subscribers to this user acting as a tipster. */
    public function subscribers(): HasMany
    {
        return $this->hasMany(Subscription::class, 'tipster_id');
    }

    public function isApprovedTipster(): bool
    {
        return $this->tipster_status === TipsterStatus::Approved;
    }

    public function latestReliability(): ?ReliabilitySnapshot
    {
        return $this->reliabilitySnapshots()->latest('id')->first();
    }
}

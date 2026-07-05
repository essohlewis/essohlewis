<?php

namespace App\Enums;

enum TipsterStatus: string
{
    case None = 'none';
    case Pending = 'pending';
    case Approved = 'approved';
    case Suspended = 'suspended';

    public function canPublish(): bool
    {
        return $this === self::Approved;
    }
}

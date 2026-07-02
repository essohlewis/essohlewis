<?php

namespace App\Services\MobileMoney;

class CollectionResult
{
    public function __construct(
        public string $providerReference,
        public string $status, // pending | completed | failed
    ) {
    }
}

<?php

namespace App\Services\MobileMoney;

interface MobileMoneyProvider
{
    /**
     * Initiate a collection (pull) from the user's Mobile Money account.
     * Returns a provider reference used later to match the confirming webhook.
     */
    public function requestCollection(string $phone, int $amountCents, string $currency, string $idempotencyKey): CollectionResult;

    /**
     * Verify the signature of an incoming webhook payload.
     */
    public function verifyWebhookSignature(string $payload, string $signature): bool;
}

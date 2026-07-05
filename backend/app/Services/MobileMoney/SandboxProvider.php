<?php

namespace App\Services\MobileMoney;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Local/dev Mobile Money driver. Simulates an Orange/MTN collection: it returns a
 * `pending` reference immediately; confirmation arrives via the webhook endpoint
 * (in dev you post to it manually or a job auto-confirms). Signature verification
 * uses a shared secret HMAC, mirroring the real providers' scheme.
 */
class SandboxProvider implements MobileMoneyProvider
{
    public function __construct(private string $secret)
    {
    }

    public function requestCollection(string $phone, int $amountCents, string $currency, string $idempotencyKey): CollectionResult
    {
        $ref = 'momo_sandbox_'.Str::uuid()->toString();

        Log::info('Sandbox Mobile Money collection requested', [
            'phone' => $phone,
            'amount_cents' => $amountCents,
            'currency' => $currency,
            'idempotency_key' => $idempotencyKey,
            'provider_reference' => $ref,
        ]);

        return new CollectionResult($ref, 'pending');
    }

    public function verifyWebhookSignature(string $payload, string $signature): bool
    {
        $expected = hash_hmac('sha256', $payload, $this->secret);

        return hash_equals($expected, $signature);
    }
}

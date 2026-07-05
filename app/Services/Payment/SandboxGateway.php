<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use Transouscris\Core\Config;
use Transouscris\Models\PaymentIntent;

/**
 * Passerelle de SIMULATION pour le développement (APP_DEBUG=true uniquement).
 *
 * Elle n'appelle aucun fournisseur : l'utilisateur est redirigé vers une page
 * interne (/dev/pay) où il confirme ou annule le paiement. La confirmation
 * marque l'intention puis passe par EXACTEMENT le même circuit que les vraies
 * passerelles (re-vérification serveur + crédit idempotent) — le test est donc
 * fidèle au flux de production, sans compte marchand.
 *
 * N'est jamais proposée en production (voir PaymentGatewayFactory::available()).
 */
final class SandboxGateway extends AbstractGateway
{
    public function name(): string
    {
        return 'sandbox';
    }

    public function initialize(PaymentContext $ctx): GatewayInitResult
    {
        $url = rtrim((string) Config::get('app.url'), '/') . '/dev/pay?ref=' . rawurlencode($ctx->reference);
        return GatewayInitResult::ok(
            redirectUrl: $url,
            token: $ctx->reference,
            providerTxnId: $ctx->reference,
            raw: ['sandbox' => true]
        );
    }

    public function verify(string $reference, ?string $providerTransactionId = null): GatewayVerification
    {
        $intent = PaymentIntent::findByReference($reference);
        if ($intent === null) {
            return new GatewayVerification(PaymentStatus::FAILED, $reference, 0);
        }

        // L'état de la simulation est porté par la métadonnée `sandbox_status`,
        // positionnée par la page de confirmation interne.
        $status = match ($intent->metadataArray()['sandbox_status'] ?? 'pending') {
            'success'   => PaymentStatus::SUCCESS,
            'cancelled' => PaymentStatus::CANCELLED,
            default     => PaymentStatus::PENDING,
        };

        // Montant renvoyé = montant de l'intention (le contrôle anti-fraude de
        // PaymentService reste exercé).
        return new GatewayVerification($status, $reference, $intent->amount, 'XOF', ['sandbox' => true]);
    }

    public function verifyWebhookSignature(string $rawBody, array $headers): bool
    {
        // Pas de webhook externe en simulation.
        return true;
    }

    public function parseWebhook(array $payload): WebhookEvent
    {
        return new WebhookEvent((string) ($payload['ref'] ?? ''), null);
    }
}

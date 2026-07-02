<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Résultat de l'initialisation d'un paiement : où rediriger l'utilisateur et
 * la référence attribuée par le fournisseur (à re-vérifier plus tard côté serveur).
 */
final class GatewayInitResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?string $redirectUrl = null,
        public readonly ?string $paymentToken = null,
        public readonly ?string $providerTransactionId = null,
        public readonly ?string $error = null,
        public readonly array $raw = []
    ) {}

    public static function ok(?string $redirectUrl, ?string $token = null, ?string $providerTxnId = null, array $raw = []): self
    {
        return new self(true, $redirectUrl, $token, $providerTxnId, null, $raw);
    }

    public static function fail(string $error, array $raw = []): self
    {
        return new self(false, null, null, null, $error, $raw);
    }
}

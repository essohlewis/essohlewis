<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Données nécessaires pour initialiser un paiement, indépendantes du fournisseur.
 * `reference` est notre identifiant de transaction (idempotence + rapprochement).
 */
final class PaymentContext
{
    public function __construct(
        public readonly string $reference,
        public readonly int $amount,            // unités mineures (XOF entier)
        public readonly string $currency,
        public readonly string $description,
        public readonly string $customerPhone,
        public readonly ?string $customerName = null,
        public readonly ?string $customerEmail = null,
        public readonly ?string $returnUrl = null,
        public readonly ?string $notifyUrl = null,
        public readonly array $metadata = []
    ) {}
}

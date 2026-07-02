<?php

declare(strict_types=1);

namespace Transouscris\Services;

/**
 * Coordonnées client transmises à l'initialisation d'un paiement.
 */
final class PaymentContextData
{
    public function __construct(
        public readonly string $phone,
        public readonly ?string $name = null,
        public readonly ?string $email = null
    ) {}
}

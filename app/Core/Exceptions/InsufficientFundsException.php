<?php

declare(strict_types=1);

namespace Transouscris\Core\Exceptions;

use RuntimeException;

/**
 * Levée par le WalletService lorsqu'un débit dépasserait le solde disponible.
 * Ne doit jamais entraîner d'écriture partielle au grand livre.
 */
final class InsufficientFundsException extends RuntimeException
{
    public function __construct(
        public readonly int $walletId,
        public readonly int $requested,
        public readonly int $available
    ) {
        parent::__construct(sprintf(
            'Solde insuffisant sur le portefeuille #%d : demandé %d, disponible %d.',
            $walletId,
            $requested,
            $available
        ));
    }
}

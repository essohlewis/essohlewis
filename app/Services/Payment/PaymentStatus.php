<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Statut normalisé d'une transaction de paiement, indépendant du fournisseur.
 */
enum PaymentStatus: string
{
    case PENDING   = 'pending';
    case SUCCESS   = 'success';
    case FAILED    = 'failed';
    case CANCELLED = 'cancelled';
    case EXPIRED   = 'expired';

    public function isFinal(): bool
    {
        return $this !== self::PENDING;
    }

    public function isPaid(): bool
    {
        return $this === self::SUCCESS;
    }
}

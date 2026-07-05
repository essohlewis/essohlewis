<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Résultat d'une RE-VÉRIFICATION serveur du statut d'une transaction.
 *
 * C'est l'unique source de vérité autorisée à déclencher un crédit : le contenu
 * d'un webhook n'est JAMAIS cru sur parole — on rappelle toujours l'API du
 * fournisseur pour confirmer statut ET montant (anti-fraude / anti-rejeu).
 */
final class GatewayVerification
{
    public function __construct(
        public readonly PaymentStatus $status,
        public readonly string $providerTransactionId,
        public readonly int $amount,          // montant confirmé (unités mineures)
        public readonly string $currency = 'XOF',
        public readonly array $raw = []
    ) {}
}

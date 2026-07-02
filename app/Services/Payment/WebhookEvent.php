<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Événement extrait d'un webhook fournisseur, après vérification de signature.
 * Ne porte que les identifiants nécessaires à la re-vérification serveur ;
 * le statut annoncé ici est purement indicatif.
 */
final class WebhookEvent
{
    public function __construct(
        public readonly string $reference,               // notre référence
        public readonly ?string $providerTransactionId,  // référence fournisseur
        public readonly ?PaymentStatus $announcedStatus = null,
        public readonly array $raw = []
    ) {}
}

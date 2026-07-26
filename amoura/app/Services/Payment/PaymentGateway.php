<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

/**
 * Contrat commun à toutes les passerelles de paiement.
 * Principe de sécurité central : ne JAMAIS activer un abonnement sur la
 * seule foi d'un retour navigateur. Toujours re-vérifier côté serveur
 * (verify()) ou via webhook signé avant activation.
 */
interface PaymentGateway
{
    /**
     * Initialise un paiement.
     * @return array{ok:bool, redirect_url:?string, client:?array, reference:?string, error:?string}
     */
    public function createCheckout(array $transaction, array $plan, string $returnUrl, string $webhookUrl): array;

    /**
     * Vérifie le statut réel d'une transaction auprès du prestataire.
     * @return array{ok:bool, paid:bool, reference:?string, error:?string}
     */
    public function verify(string $reference, array $transaction): array;

    /**
     * Valide la signature d'un webhook entrant.
     */
    public function verifyWebhookSignature(string $payload, array $headers): bool;
}

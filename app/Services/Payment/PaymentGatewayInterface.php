<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

/**
 * Contrat commun à tous les fournisseurs de paiement (CinetPay, PayDunya, Wave,
 * Stripe...). Ajouter un fournisseur = implémenter cette interface et l'enregistrer
 * dans PaymentGatewayFactory — aucun autre code métier à modifier.
 */
interface PaymentGatewayInterface
{
    /** Identifiant court et stable du fournisseur (ex: "cinetpay"). */
    public function name(): string;

    /**
     * Initialise un paiement et retourne l'URL/jeton de redirection.
     */
    public function initialize(PaymentContext $context): GatewayInitResult;

    /**
     * RE-VÉRIFIE côté serveur le statut réel d'une transaction auprès de l'API
     * du fournisseur. Seul appel autorisé à conclure qu'un paiement est acquis.
     *
     * @param string $reference              notre référence
     * @param string|null $providerTransactionId  référence fournisseur si connue
     */
    public function verify(string $reference, ?string $providerTransactionId = null): GatewayVerification;

    /**
     * Vérifie l'authenticité d'un webhook (signature HMAC / token) AVANT tout
     * traitement. Retourne false si la signature est absente ou invalide.
     *
     * @param array<string,string> $headers
     */
    public function verifyWebhookSignature(string $rawBody, array $headers): bool;

    /**
     * Extrait les identifiants d'un payload de webhook déjà authentifié.
     *
     * @param array<string,mixed> $payload
     */
    public function parseWebhook(array $payload): WebhookEvent;
}

<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Config;
use Transouscris\Core\Logger;
use Transouscris\Models\Pot;
use Transouscris\Models\PaymentIntent;
use Transouscris\Services\Payment\GatewayInitResult;
use Transouscris\Services\Payment\PaymentContext;
use Transouscris\Services\Payment\PaymentGatewayFactory;
use Transouscris\Services\Payment\PaymentStatus;

/**
 * Orchestration des paiements (approvisionnement wallet, contribution cagnotte).
 *
 * Règle d'or : le crédit du wallet n'est JAMAIS déclenché par le contenu d'un
 * webhook. À réception d'un webhook (signature déjà vérifiée), on RE-VÉRIFIE le
 * statut ET le montant directement auprès de l'API du fournisseur, puis on ne
 * crédite qu'en cas de succès confirmé — le tout de manière idempotente.
 */
final class PaymentService
{
    public function __construct(
        private WalletService $wallet = new WalletService(),
        private AuditLogger $audit = new AuditLogger()
    ) {}

    /**
     * Initialise un approvisionnement de portefeuille.
     */
    public function startWalletTopup(int $userId, string $gateway, int $amount, PaymentContextData $customer): GatewayInitResult
    {
        $intent  = PaymentIntent::start($userId, $gateway, 'wallet_topup', $amount);
        return $this->initialize($intent, $customer, 'Approvisionnement portefeuille Transouscris');
    }

    /**
     * Initialise une contribution à une cagnotte (le contributeur n'a pas besoin
     * de compte : le paiement est rattaché à la cagnotte, pas à un wallet).
     */
    public function startPotContribution(Pot $pot, int $amount, string $gateway, PaymentContextData $customer): GatewayInitResult
    {
        $intent = PaymentIntent::start(
            $pot->ownerUserId,
            $gateway,
            'pot_contribution',
            $amount,
            ['pot_id' => $pot->id, 'contributor' => $customer->name]
        );
        return $this->initialize($intent, $customer, 'Contribution cagnotte : ' . $pot->title);
    }

    private function initialize(PaymentIntent $intent, PaymentContextData $customer, string $description): GatewayInitResult
    {
        $gateway = PaymentGatewayFactory::make($intent->gateway);
        $appUrl  = rtrim(Config::get('app.url'), '/');

        $ctx = new PaymentContext(
            reference: $intent->reference,
            amount: $intent->amount,
            currency: 'XOF',
            description: $description,
            customerPhone: $customer->phone,
            customerName: $customer->name,
            customerEmail: $customer->email,
            returnUrl: $appUrl . '/payment/return?ref=' . $intent->reference,
            notifyUrl: $appUrl . '/webhooks/' . $intent->gateway,
            metadata: ['reference' => $intent->reference]
        );

        $result = $gateway->initialize($ctx);
        if (!$result->success) {
            $intent->markStatus(PaymentStatus::FAILED);
            Logger::error('Initialisation paiement échouée', ['ref' => $intent->reference, 'error' => $result->error]);
        } elseif ($result->providerTransactionId !== null) {
            // Mémorise la référence fournisseur pour la future re-vérification.
            PaymentIntent::pdo()->prepare(
                'UPDATE payment_intents SET provider_transaction_id = :ptid WHERE id = :id'
            )->execute(['ptid' => $result->providerTransactionId, 'id' => $intent->id]);
        }
        return $result;
    }

    /**
     * Traite un webhook déjà authentifié : re-vérifie le statut auprès du
     * fournisseur puis applique le crédit si (et seulement si) le paiement est
     * réellement acquis et le montant concorde. Idempotent.
     *
     * @return PaymentStatus statut confirmé
     */
    public function handleConfirmedReference(string $gatewayName, string $reference, ?string $providerTxnId): PaymentStatus
    {
        $intent = PaymentIntent::findByReference($reference);
        if ($intent === null) {
            Logger::warning('Webhook pour référence inconnue', ['ref' => $reference, 'gateway' => $gatewayName]);
            return PaymentStatus::FAILED;
        }

        // Idempotence : déjà traité → on ne recrédite pas.
        if ($intent->status === 'paid') {
            return PaymentStatus::SUCCESS;
        }

        $gateway = PaymentGatewayFactory::make($gatewayName);
        $verification = $gateway->verify($reference, $providerTxnId ?? $intent->providerTransactionId);

        $this->audit->log('payment.verify', 'payment_intent', $intent->id, [
            'reference'      => $reference,
            'status'         => $verification->status->value,
            'amount_checked' => $verification->amount,
        ], $intent->userId);

        if (!$verification->status->isPaid()) {
            if ($verification->status->isFinal()) {
                $intent->markStatus($verification->status);
            }
            return $verification->status;
        }

        // Contrôle anti-fraude : le montant confirmé doit correspondre.
        if ($verification->amount !== $intent->amount) {
            Logger::error('Écart de montant sur paiement — crédit refusé', [
                'reference' => $reference,
                'attendu'   => $intent->amount,
                'confirmé'  => $verification->amount,
            ]);
            $intent->markStatus(PaymentStatus::FAILED);
            return PaymentStatus::FAILED;
        }

        $this->applyPaidIntent($intent, $verification->providerTransactionId);
        return PaymentStatus::SUCCESS;
    }

    private function applyPaidIntent(PaymentIntent $intent, ?string $providerTxnId): void
    {
        $metadata = $intent->metadataArray();

        if ($intent->purpose === 'wallet_topup') {
            $ledgerTxnId = $this->wallet->credit(
                userId: $intent->userId,
                amount: $intent->amount,
                reference: 'topup:' . $intent->reference,
                type: 'wallet_topup',
                sourceCode: 'GATEWAY_CLEARING',
                metadata: ['payment_intent_id' => $intent->id, 'gateway' => $intent->gateway]
            );
            $intent->markPaid($providerTxnId, $ledgerTxnId);
            return;
        }

        if ($intent->purpose === 'pot_contribution' && isset($metadata['pot_id'])) {
            $pot = Pot::find((int) $metadata['pot_id']);
            if ($pot !== null) {
                // Crédite le portefeuille du propriétaire de la cagnotte.
                $ledgerTxnId = $this->wallet->credit(
                    userId: $pot->ownerUserId,
                    amount: $intent->amount,
                    reference: 'pot:' . $intent->reference,
                    type: 'pot_contribution',
                    sourceCode: 'GATEWAY_CLEARING',
                    metadata: ['pot_id' => $pot->id, 'payment_intent_id' => $intent->id]
                );
                $pot->addCollected($intent->amount);
                $intent->markPaid($providerTxnId, $ledgerTxnId);
            }
            return;
        }

        $intent->markPaid($providerTxnId, null);
    }
}

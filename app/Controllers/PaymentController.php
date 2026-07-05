<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Logger;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\PaymentIntent;
use Transouscris\Services\Payment\PaymentGatewayFactory;
use Transouscris\Services\PaymentService;

/**
 * Webhooks fournisseurs et page de retour.
 *
 * Le flux webhook applique la règle de sécurité imposée :
 *   1. Vérifier la SIGNATURE du webhook (rejet immédiat si invalide).
 *   2. Extraire uniquement les identifiants (référence + txn fournisseur).
 *   3. RE-VÉRIFIER côté serveur le statut/montant réel auprès de l'API.
 *   4. Créditer le wallet seulement si le paiement est confirmé (idempotent).
 *
 * Ces routes sont EXCLUES de la protection CSRF (appels serveur-à-serveur) et
 * s'appuient exclusivement sur la signature HMAC du fournisseur.
 */
final class PaymentController extends Controller
{
    public function __construct(private PaymentService $payments = new PaymentService()) {}

    public function webhook(Request $request, string $gatewayName): Response
    {
        if (!in_array($gatewayName, PaymentGatewayFactory::available(), true)) {
            return $this->json(['error' => 'Fournisseur inconnu.'], 404);
        }

        $gateway = PaymentGatewayFactory::make($gatewayName);
        $raw     = $request->rawBody();

        // Reconstitue les en-têtes pour la vérification de signature.
        $headers = [
            'x-token'         => $request->header('x-token'),
            'wave-signature'  => $request->header('wave-signature'),
            'content-type'    => $request->header('content-type'),
        ];

        // 1) Signature obligatoire.
        if (!$gateway->verifyWebhookSignature($raw, array_filter($headers))) {
            Logger::warning('Webhook signature invalide', ['gateway' => $gatewayName]);
            return $this->json(['error' => 'Signature invalide.'], 401);
        }

        // 2) Parse le payload (form-encoded ou JSON selon le fournisseur).
        $payload = $request->isJson() ? $request->jsonInput() : $this->parseForm($raw);
        $event   = $gateway->parseWebhook($payload);

        if ($event->reference === '') {
            return $this->json(['error' => 'Référence absente.'], 422);
        }

        // 3) + 4) Re-vérification serveur + crédit idempotent.
        $status = $this->payments->handleConfirmedReference(
            $gatewayName,
            $event->reference,
            $event->providerTransactionId
        );

        // On répond 200 pour accuser réception ; le statut réel est journalisé.
        return $this->json(['received' => true, 'status' => $status->value]);
    }

    /** Page de retour après paiement : re-vérifie aussi (l'utilisateur peut revenir avant le webhook). */
    public function returnPage(Request $request): Response
    {
        $reference = (string) $request->query('ref', '');
        $intent    = $reference !== '' ? PaymentIntent::findByReference($reference) : null;

        if ($intent !== null && $intent->status === 'pending') {
            // Tente une re-vérification opportuniste (ne bloque pas l'affichage).
            $this->payments->handleConfirmedReference($intent->gateway, $intent->reference, $intent->providerTransactionId);
            $intent = PaymentIntent::findByReference($reference);
        }

        return $this->view('wallet.return', [
            'title'  => 'Retour de paiement',
            'intent' => $intent,
        ]);
    }

    private function parseForm(string $raw): array
    {
        parse_str($raw, $data);
        return $data;
    }
}

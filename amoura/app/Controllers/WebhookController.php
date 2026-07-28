<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Models\Transaction;
use Amoura\Services\Payment\GatewayFactory;

/**
 * Réception des webhooks de paiement. Flux sécurisé :
 *  1) Vérifier la signature du webhook (si supportée).
 *  2) Retrouver la transaction locale.
 *  3) RE-VÉRIFIER le statut auprès du prestataire (source de vérité).
 *  4) N'activer l'abonnement qu'après confirmation (idempotent).
 */
final class WebhookController extends Controller
{
    public function handle(Request $request, array $params): void
    {
        $gatewayName = (string) $params['gateway'];
        if (!in_array($gatewayName, GatewayFactory::available(), true)) {
            Response::error('Passerelle inconnue', 404);
        }

        $payload = file_get_contents('php://input') ?: '';
        $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        $gateway = GatewayFactory::make($gatewayName);

        // 1) Signature.
        if (!$gateway->verifyWebhookSignature($payload, $headers)) {
            Response::error('Signature invalide', 400);
        }

        // 2) Référence de transaction (selon le format du prestataire).
        $body = json_decode($payload, true) ?: $_POST;
        $reference = $this->extractReference($gatewayName, $body);
        if ($reference === null) {
            Response::ok(['ignored' => true]);
        }

        $txModel = new Transaction();
        $tx = $txModel->byGatewayRef($gatewayName, $reference)
            ?? $this->lookupByLocalRef($txModel, $body);
        if (!$tx) {
            // On répond 200 pour éviter les renvois infinis, mais rien n'est activé.
            Response::ok(['unmatched' => true]);
        }

        // 3) Re-vérification serveur (ne jamais faire confiance au corps du webhook).
        $check = $gateway->verify($reference, $tx);

        // 4) Activation idempotente.
        if ($check['ok'] && $check['paid']) {
            SubscriptionController::fulfill($tx, (string) ($check['reference'] ?? $reference));
            Response::ok(['fulfilled' => true]);
        }

        Response::ok(['pending' => true]);
    }

    private function extractReference(string $gateway, array $body): ?string
    {
        return match ($gateway) {
            'cinetpay' => $body['cpm_trans_id'] ?? $body['transaction_id'] ?? null,
            'paydunya' => $body['data']['invoice']['token'] ?? $body['token'] ?? null,
            'stripe'   => $body['data']['object']['id'] ?? null,
            'paypal'   => $body['resource']['id'] ?? null,
            'flutterwave' => $body['data']['tx_ref'] ?? $body['txRef'] ?? null,
            default    => null,
        };
    }

    private function lookupByLocalRef(Transaction $txModel, array $body): ?array
    {
        // Certains prestataires renvoient notre identifiant local dans metadata.
        $localId = $body['custom_data']['transaction_id']
            ?? $body['data']['object']['client_reference_id']
            ?? null;
        return $localId ? $txModel->find((int) $localId) : null;
    }
}

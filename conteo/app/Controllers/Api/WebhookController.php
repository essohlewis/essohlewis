<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Helpers\Logger;
use App\Models\PackPurchase;
use App\Models\Payment;
use App\Models\Subscription;
use App\Services\CinetPayService;
use App\Services\PayDunyaService;

/**
 * Webhooks de paiement.
 *
 * RÈGLE DE SÉCURITÉ IMPÉRATIVE (§6) :
 * Aucune action financière n'est déclenchée par le simple callback. Chaque
 * webhook RE-VÉRIFIE la transaction en appelant l'API du fournisseur avec la
 * référence, et ne crédite que si :
 *   - le fournisseur confirme le statut SUCCESS (serveur-à-serveur), ET
 *   - le montant confirmé == montant attendu enregistré localement.
 * `payments.verified_at` n'est renseigné qu'après cette re-vérification.
 */
final class WebhookController extends Controller
{
    public function __construct(
        private Payment $payments = new Payment(),
        private Subscription $subscriptions = new Subscription(),
        private PackPurchase $purchases = new PackPurchase(),
    ) {
    }

    /** POST /api/v1/webhooks/cinetpay (public) */
    public function cinetpay(Request $request): void
    {
        $service = new CinetPayService();

        // 1) Whitelist d'IP.
        if (!$service->isWhitelistedIp($request->ip())) {
            Logger::warning('CinetPay webhook: IP refusée', ['ip' => $request->ip()]);
            Response::error('IP non autorisée.', 403);
            return;
        }

        // 2) Référence transmise par le callback (jamais le statut brut).
        $reference = (string) ($request->input('cpm_trans_id') ?? $request->all()['cpm_trans_id'] ?? $_POST['cpm_trans_id'] ?? '');
        if ($reference === '') {
            Response::error('Référence manquante.', 422);
            return;
        }

        // 3) RE-VÉRIFICATION serveur-à-serveur.
        $result = $service->checkPayStatus($reference);
        $this->settle($reference, $result);

        Response::ok(['received' => true]);
    }

    /** POST /api/v1/webhooks/paydunya (public) */
    public function paydunya(Request $request): void
    {
        $service = new PayDunyaService();

        if (!$service->isWhitelistedIp($request->ip())) {
            Logger::warning('PayDunya webhook: IP refusée', ['ip' => $request->ip()]);
            Response::error('IP non autorisée.', 403);
            return;
        }

        // PayDunya transmet un token de facture ; la référence est en custom_data.
        $token = (string) ($request->input('data')['invoice']['token']
            ?? $_POST['data']['invoice']['token']
            ?? $request->input('token')
            ?? '');
        if ($token === '') {
            Response::error('Token manquant.', 422);
            return;
        }

        // RE-VÉRIFICATION serveur-à-serveur via le token.
        $result = $service->confirm($token);
        $reference = (string) ($result['raw']['custom_data']['reference'] ?? '');
        if ($reference === '') {
            // Repli : recherche par provider_tx_id.
            $payment = $this->payments->findBy('provider_tx_id', $token);
            $reference = $payment['reference'] ?? '';
        }
        if ($reference === '') {
            Response::error('Référence introuvable.', 422);
            return;
        }

        $this->settle($reference, $result);
        Response::ok(['received' => true]);
    }

    /**
     * Applique le résultat vérifié : crédite l'utilisateur si et seulement si
     * le statut est success ET le montant correspond. Idempotent.
     *
     * @param array{status:string,amount:int,provider_tx_id:?string,raw:array} $result
     */
    private function settle(string $reference, array $result): void
    {
        $payment = $this->payments->findByReference($reference);
        if ($payment === null) {
            Logger::warning('Webhook: paiement inconnu', ['ref' => $reference]);
            return;
        }

        // Idempotence : déjà traité et vérifié.
        if ($payment['status'] === 'success' && $payment['verified_at'] !== null) {
            return;
        }

        $expectedAmount = (int) $payment['amount_fcfa'];
        $confirmedAmount = (int) $result['amount'];

        // Contrôle du montant : refus si divergence.
        $amountOk = $confirmedAmount === $expectedAmount;
        $finalStatus = ($result['status'] === 'success' && $amountOk) ? 'success' : $result['status'];

        if ($result['status'] === 'success' && !$amountOk) {
            Logger::error('Webhook: montant divergent', [
                'ref' => $reference, 'expected' => $expectedAmount, 'confirmed' => $confirmedAmount,
            ]);
            $finalStatus = 'failed';
        }

        // Transaction atomique : marquer vérifié + créditer.
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $this->payments->markVerified(
                (int) $payment['id'],
                $finalStatus,
                $result['provider_tx_id'],
                $result['raw']
            );

            if ($finalStatus === 'success') {
                $this->grantEntitlement($payment);
            }

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            Logger::error('Webhook settle failed', ['ref' => $reference, 'err' => $e->getMessage()]);
        }
    }

    /** @param array<string,mixed> $payment */
    private function grantEntitlement(array $payment): void
    {
        if ($payment['purpose'] === 'subscription') {
            $subId = (int) $payment['purpose_id'];
            $sub = $this->subscriptions->find($subId);
            if ($sub && (int) $sub['user_id'] === (int) $payment['user_id']) {
                $this->subscriptions->activate($subId, (string) $sub['plan']);
            }
            return;
        }

        // pack : purpose_id = pack_id
        $packId = (int) $payment['purpose_id'];
        $purchase = $this->purchases->findPending((int) $payment['user_id'], $packId);
        if ($purchase) {
            $this->purchases->markPaid((int) $purchase['id']);
        }
    }
}

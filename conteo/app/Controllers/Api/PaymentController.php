<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Helpers\RateLimit;
use App\Models\Pack;
use App\Models\PackPurchase;
use App\Models\Payment;
use App\Models\Subscription;
use App\Services\CinetPayService;
use App\Services\PayDunyaService;

final class PaymentController extends Controller
{
    public function __construct(
        private Payment $payments = new Payment(),
        private Pack $packs = new Pack(),
        private Subscription $subscriptions = new Subscription(),
        private PackPurchase $purchases = new PackPurchase(),
    ) {
    }

    /** GET /api/v1/plans (public) */
    public function plans(Request $request): void
    {
        $config = require dirname(__DIR__, 3) . '/config/config.php';
        Response::ok([
            'plans' => [
                ['id' => 'monthly', 'price_fcfa' => $config['plans']['monthly']['price_fcfa'], 'label' => $config['plans']['monthly']['label']],
                ['id' => 'yearly',  'price_fcfa' => $config['plans']['yearly']['price_fcfa'],  'label' => $config['plans']['yearly']['label']],
            ],
        ]);
    }

    /**
     * POST /api/v1/payments/initiate (auth)
     * Crée une transaction locale (pending) + initialise le paiement fournisseur.
     */
    public function initiate(Request $request): void
    {
        $config = require dirname(__DIR__, 3) . '/config/config.php';
        if (RateLimit::tooMany('pay:' . $request->ip(), $config['rate']['pay_max'], $config['rate']['pay_window'])) {
            Response::error('Trop de tentatives de paiement.', 429);
            return;
        }

        $v = new Validator($request->all(), [
            'purpose'    => 'required|in:subscription,pack',
            'purpose_id' => 'required|string|max:20',
            'provider'   => 'required|in:cinetpay,paydunya',
            'channel'    => 'in:wave,orange_money,mtn_momo,moov_money',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $purpose = (string) $request->input('purpose');
        $provider = (string) $request->input('provider');
        $channel = (string) $request->input('channel', 'wave');
        $userId = $this->userId();

        // Détermine le montant côté serveur (jamais depuis le client).
        [$amount, $purposeId] = $this->resolveAmount($purpose, (string) $request->input('purpose_id'), $config, $userId);
        if ($amount <= 0) {
            Response::error('Offre invalide.', 422);
            return;
        }

        $reference = Payment::newReference();
        $paymentId = $this->payments->insert([
            'user_id'     => $userId,
            'reference'   => $reference,
            'provider'    => $provider,
            'channel'     => $channel,
            'amount_fcfa' => $amount,
            'purpose'     => $purpose,
            'purpose_id'  => $purposeId,
            'status'      => 'pending',
        ]);

        $desc = $purpose === 'subscription' ? 'Abonnement CONTEO' : 'Pack de contes CONTEO';
        $returnUrl = $config['app']['url'] . '/paiement/retour?ref=' . $reference;
        $notifyUrl = $config['app']['url'] . '/api/v1/webhooks/' . $provider;

        try {
            if ($provider === 'cinetpay') {
                $res = (new CinetPayService())->initiate($reference, $amount, $desc, $channel, $returnUrl, $notifyUrl);
            } else {
                $res = (new PayDunyaService())->initiate($reference, $amount, $desc, $returnUrl, $notifyUrl);
            }
        } catch (\Throwable $e) {
            $this->payments->update($paymentId, ['status' => 'failed']);
            Response::error('Le service de paiement est momentanément indisponible.', 502);
            return;
        }

        if (!empty($res['provider_tx_id'])) {
            $this->payments->update($paymentId, ['provider_tx_id' => $res['provider_tx_id']]);
        }

        Response::ok([
            'reference'   => $reference,
            'payment_url' => $res['payment_url'],
        ], 201);
    }

    /** GET /api/v1/payments/{reference} (auth) — statut (protection IDOR) */
    public function status(Request $request): void
    {
        $reference = (string) $request->param('reference');
        $payment = $this->payments->findByReference($reference);
        if ($payment === null || (int) $payment['user_id'] !== $this->userId()) {
            Response::error('Transaction introuvable.', 404);
            return;
        }
        Response::ok([
            'reference'   => $payment['reference'],
            'status'      => $payment['status'],
            'verified'    => $payment['verified_at'] !== null,
            'amount_fcfa' => (int) $payment['amount_fcfa'],
            'purpose'     => $payment['purpose'],
        ]);
    }

    /**
     * Détermine le montant attendu côté serveur.
     * @return array{0:int,1:?int} [montant, purpose_id résolu]
     */
    private function resolveAmount(string $purpose, string $rawId, array $config, int $userId): array
    {
        if ($purpose === 'subscription') {
            $plan = $rawId; // 'monthly' | 'yearly'
            if (!isset($config['plans'][$plan])) {
                return [0, null];
            }
            // Crée l'abonnement en pending, rattaché à la transaction.
            $subId = $this->subscriptions->insert([
                'user_id' => $userId,
                'plan'    => $plan,
                'status'  => 'pending',
            ]);
            return [(int) $config['plans'][$plan]['price_fcfa'], $subId];
        }

        // pack
        $pack = $this->packs->find((int) $rawId);
        if ($pack === null || (int) $pack['is_active'] !== 1) {
            return [0, null];
        }
        // Crée l'achat en pending (ou réutilise si déjà présent non payé).
        $this->purchases->ensurePending($userId, (int) $pack['id'], (int) $pack['price_fcfa']);
        return [(int) $pack['price_fcfa'], (int) $pack['id']];
    }
}

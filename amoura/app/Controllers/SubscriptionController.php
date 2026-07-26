<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ActivityLog;
use Amoura\Models\Notification;
use Amoura\Models\Plan;
use Amoura\Models\Subscription;
use Amoura\Models\Transaction;
use Amoura\Services\Payment\CinetPayGateway;
use Amoura\Services\Payment\GatewayFactory;

final class SubscriptionController extends Controller
{
    public function plans(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('subscription/plans', [
            'plans' => (new Plan())->active(),
            'current' => (new Subscription())->activeFor((int) $user['id']),
            'gateways' => GatewayFactory::available(),
        ]);
    }

    /**
     * Démarre un paiement : crée une transaction « initiated » et redirige vers
     * la passerelle. L'activation n'aura lieu qu'après vérification serveur.
     */
    public function subscribe(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];

        $planSlug = (string) $request->input('plan');
        $gateway = (string) $request->input('gateway');
        $plan = (new Plan())->bySlug($planSlug);

        if (!$plan || (int) $plan['price_cents'] === 0) {
            Session::flash('error', 'Plan invalide.');
            $this->redirect('/premium');
        }
        if (!in_array($gateway, GatewayFactory::available(), true)) {
            Session::flash('error', 'Moyen de paiement invalide.');
            $this->redirect('/premium');
        }

        $phone = Sanitizer::phone((string) $request->input('phone'));
        $method = null;
        if ($gateway === 'cinetpay' && $phone) {
            $method = CinetPayGateway::operatorFromPhone($phone);
        }

        // Coupon de réduction éventuel.
        $amount = (int) $plan['price_cents'];
        $couponCode = trim((string) $request->input('coupon'));
        $meta = [];
        if ($couponCode !== '') {
            $coupon = (new \Amoura\Models\Coupon())->valid($couponCode);
            if ($coupon) {
                $amount = \Amoura\Models\Coupon::apply($coupon, $amount);
                (new \Amoura\Models\Coupon())->redeem((int) $coupon['id']);
                $meta['coupon'] = $coupon['code'];
            }
        }

        // Transaction en base (source de vérité côté serveur).
        $txModel = new Transaction();
        $txId = $txModel->initiate($uid, (int) $plan['id'], $amount, (string) $plan['currency'], $gateway, [
            'phone' => $phone,
            'payment_method' => $method,
            'metadata' => $meta ? json_encode($meta) : null,
        ]);
        $tx = $txModel->find($txId);

        $returnUrl = rtrim((string) Env::get('APP_URL', ''), '/') . '/premium/return?tx=' . $txId;
        $webhookUrl = rtrim((string) Env::get('APP_URL', ''), '/') . '/webhooks/' . $gateway;

        $checkout = GatewayFactory::make($gateway)->createCheckout($tx, $plan, $returnUrl, $webhookUrl);
        if (!$checkout['ok']) {
            $txModel->markFailed($txId);
            Session::flash('error', $checkout['error'] ?? 'Échec de l\'initialisation du paiement.');
            $this->redirect('/premium');
        }

        // Mémorise la référence prestataire pour la vérification ultérieure.
        $txModel->update($txId, ['gateway_ref' => $checkout['reference'], 'status' => 'pending']);
        (new ActivityLog())->record($uid, 'payment.initiated', 'transaction', $txId, ['gateway' => $gateway]);

        Session::put('pending_tx', $txId);
        if (!empty($checkout['redirect_url'])) {
            $this->redirect($checkout['redirect_url']);
        }
        // Passerelle sans redirection (paiement embarqué) : page d'attente.
        $this->view('subscription/processing', ['tx' => $txId, 'client' => $checkout['client']]);
    }

    /**
     * Retour navigateur après paiement : NE PAS activer ici sur la seule
     * confiance du retour. On revérifie systématiquement auprès du prestataire.
     */
    public function paymentReturn(Request $request): void
    {
        $user = $this->requireAuth($request);
        $txId = (int) $request->query('tx', 0);
        $txModel = new Transaction();
        $tx = $txModel->find($txId);

        // Redirige vers la boutique pour un achat à l'unité, sinon vers Premium.
        $back = !empty($tx['product_id']) ? '/store' : '/premium';

        if (!$tx || (int) $tx['user_id'] !== (int) $user['id']) {
            Session::flash('error', 'Transaction introuvable.');
            $this->redirect('/premium');
        }
        if ($tx['status'] === 'paid') {
            Session::flash('success', 'Paiement déjà confirmé.');
            $this->redirect($back);
        }

        $gateway = GatewayFactory::make((string) $tx['gateway']);
        $check = $gateway->verify((string) $tx['gateway_ref'], $tx);

        if ($check['ok'] && $check['paid']) {
            $this->fulfill($tx, (string) ($check['reference'] ?? $tx['gateway_ref']));
            Session::flash('success', 'Paiement confirmé ✅');
        } else {
            Session::flash('error', 'Paiement non confirmé. Si vous avez été débité, contactez le support.');
        }
        $this->redirect($back);
    }

    /** Historique de facturation de l'utilisateur (abonnements + achats). */
    public function history(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('subscription/history', [
            'transactions' => (new Transaction())->forUser((int) $user['id']),
        ]);
    }

    /** Reçu imprimable d'une transaction payée (mise en page dédiée). */
    public function receipt(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $tx = (new Transaction())->receiptFor((int) ($params['id'] ?? 0), (int) $user['id']);
        if (!$tx) {
            Session::flash('error', 'Reçu introuvable.');
            $this->redirect('/premium/history');
        }
        // Layout minimal (imprimable) plutôt que la coque applicative.
        $this->view('subscription/receipt', [
            'tx' => $tx,
            'user' => $user,
            'appName' => (string) Env::get('APP_NAME', 'Amoura'),
        ], 'layouts/receipt');
    }

    public function cancel(Request $request): void
    {
        $user = $this->requireAuth($request);
        (new Subscription())->cancel((int) $user['id']);
        (new ActivityLog())->record((int) $user['id'], 'subscription.canceled', 'user', (int) $user['id']);
        Session::flash('success', 'Abonnement annulé. Il reste actif jusqu\'à la fin de la période.');
        $this->redirect('/premium');
    }

    /**
     * Exécute un paiement vérifié (abonnement OU achat à l'unité), de façon
     * idempotente. Appelé par le retour navigateur ET par le webhook.
     * Délègue au service de facturation (gère plan_id ou product_id).
     */
    public static function fulfill(array $tx, string $gatewayRef): void
    {
        \Amoura\Services\Billing\Fulfillment::complete($tx, $gatewayRef);
    }
}

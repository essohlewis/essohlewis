<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ActivityLog;
use Amoura\Models\Credit;
use Amoura\Models\Product;
use Amoura\Models\Transaction;
use Amoura\Models\User;
use Amoura\Services\Payment\CinetPayGateway;
use Amoura\Services\Payment\GatewayFactory;

/** Boutique de consommables (Boost, Super Like, Reveal) — Sprint +5. */
final class StoreController extends Controller
{
    private const BOOST_MINUTES = 30;
    private const REVEAL_HOURS = 24;

    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('subscription/store', [
            'products' => (new Product())->active(),
            'credits' => (new Credit())->balances((int) $user['id']),
            'gateways' => GatewayFactory::available(),
        ]);
    }

    /** Démarre l'achat d'un consommable (crée la transaction puis redirige vers la passerelle). */
    public function buy(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];

        $product = (new Product())->bySlug((string) $request->input('product'));
        $gateway = (string) $request->input('gateway');
        if (!$product || (int) $product['is_active'] !== 1) {
            Session::flash('error', 'Produit indisponible.');
            $this->redirect('/store');
        }
        if (!in_array($gateway, GatewayFactory::available(), true)) {
            Session::flash('error', 'Moyen de paiement invalide.');
            $this->redirect('/store');
        }

        $phone = Sanitizer::phone((string) $request->input('phone'));
        $method = ($gateway === 'cinetpay' && $phone) ? CinetPayGateway::operatorFromPhone($phone) : null;

        $txModel = new Transaction();
        $txId = $txModel->initiate($uid, null, (int) $product['price_cents'], (string) $product['currency'], $gateway, [
            'product_id' => (int) $product['id'],
            'phone' => $phone,
            'payment_method' => $method,
        ]);
        $tx = $txModel->find($txId);

        $returnUrl = rtrim((string) Env::get('APP_URL', ''), '/') . '/premium/return?tx=' . $txId;
        $webhookUrl = rtrim((string) Env::get('APP_URL', ''), '/') . '/webhooks/' . $gateway;

        // La passerelle utilise name + amount ; le produit joue le rôle de « plan ».
        $checkout = GatewayFactory::make($gateway)->createCheckout($tx, $product, $returnUrl, $webhookUrl);
        if (!$checkout['ok']) {
            $txModel->markFailed($txId);
            Session::flash('error', $checkout['error'] ?? 'Échec de l\'initialisation du paiement.');
            $this->redirect('/store');
        }
        $txModel->update($txId, ['gateway_ref' => $checkout['reference'], 'status' => 'pending']);
        (new ActivityLog())->record($uid, 'purchase.initiated', 'transaction', $txId, ['product' => $product['slug']]);

        if (!empty($checkout['redirect_url'])) {
            $this->redirect($checkout['redirect_url']);
        }
        $this->view('subscription/processing', ['tx' => $txId, 'client' => $checkout['client']]);
    }

    /** Utilise un Boost : met le profil en avant pendant 30 minutes. */
    public function useBoost(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        if (!(new Credit())->consume($uid, 'boost')) {
            Session::flash('error', 'Aucun boost disponible. Achetez-en dans la boutique.');
            $this->redirect('/store');
        }
        (new User())->update($uid, ['boosted_until' => date('Y-m-d H:i:s', time() + self::BOOST_MINUTES * 60)]);
        (new ActivityLog())->record($uid, 'boost.used', 'user', $uid);
        Session::flash('success', 'Boost activé ! Votre profil est mis en avant pendant ' . self::BOOST_MINUTES . ' minutes. 🚀');
        $this->redirect('/discover');
    }

    /** Utilise un crédit Reveal : débloque « qui m'a liké » pendant 24 h. */
    public function useReveal(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        if (!(new Credit())->consume($uid, 'reveal')) {
            Session::flash('error', 'Aucun crédit « révéler » disponible.');
            $this->redirect('/store');
        }
        (new User())->update($uid, ['reveal_until' => date('Y-m-d H:i:s', time() + self::REVEAL_HOURS * 3600)]);
        (new ActivityLog())->record($uid, 'reveal.used', 'user', $uid);
        Session::flash('success', 'Vos admirateurs sont révélés pendant ' . self::REVEAL_HOURS . ' h ! 👀');
        $this->redirect('/likes');
    }
}

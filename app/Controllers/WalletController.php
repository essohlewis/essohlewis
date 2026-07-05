<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Database;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Validator;
use Transouscris\Services\Payment\PaymentGatewayFactory;
use Transouscris\Services\PaymentContextData;
use Transouscris\Services\PaymentService;

/**
 * Portefeuille : solde, historique du grand livre et approvisionnement.
 */
final class WalletController extends Controller
{
    public function __construct(private PaymentService $payments = new PaymentService()) {}

    public function show(Request $request): Response
    {
        $user   = $this->requireUser();
        $wallet = $user->wallet();

        // Historique : écritures du grand livre concernant le compte de l'utilisateur.
        $stmt = Database::connection()->prepare(
            'SELECT e.direction, e.amount, e.balance_after, e.created_at, t.type, t.reference
             FROM ledger_entries e
             JOIN ledger_transactions t ON t.id = e.ledger_transaction_id
             WHERE e.account_id = :acc
             ORDER BY e.id DESC LIMIT 100'
        );
        $stmt->execute(['acc' => $wallet->id]);

        return $this->view('wallet.show', [
            'title'   => 'Mon portefeuille',
            'wallet'  => $wallet,
            'entries' => $stmt->fetchAll(),
            'gateways'=> PaymentGatewayFactory::available(),
        ]);
    }

    /** Lance un approvisionnement du portefeuille via une passerelle. */
    public function topup(Request $request): Response
    {
        $user = $this->requireUser();
        $data = Validator::make($request->only(['amount', 'gateway']))->validate([
            'amount'  => 'required|amount|min:200|max:500000',
            'gateway' => 'required|in:' . implode(',', PaymentGatewayFactory::available()),
        ]);

        $result = $this->payments->startWalletTopup(
            userId: $user->id,
            gateway: $data['gateway'],
            amount: (int) $data['amount'],
            customer: new PaymentContextData(phone: $user->phone, name: $user->name, email: $user->email)
        );

        if (!$result->success) {
            return $this->json(['error' => $result->error ?? 'Initialisation du paiement impossible.'], 502);
        }
        return $this->json(['ok' => true, 'redirect' => $result->redirectUrl]);
    }
}

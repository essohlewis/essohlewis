<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Validator;
use Transouscris\Models\Pot;
use Transouscris\Services\Payment\PaymentGatewayFactory;
use Transouscris\Services\PaymentContextData;
use Transouscris\Services\PaymentService;

/**
 * Cagnottes de recharge collective (fonctionnalité différenciante).
 * La page de contribution est PUBLIQUE (lien partageable), la création est
 * réservée à l'utilisateur connecté.
 */
final class PotController extends Controller
{
    public function __construct(private PaymentService $payments = new PaymentService()) {}

    public function create(Request $request): Response
    {
        $user = $this->requireUser();
        $data = Validator::make($request->only(['title', 'beneficiary', 'target']))->validate([
            'title'       => 'required|string|max:120',
            'beneficiary' => 'required|phone_ci',
            'target'      => 'required|amount|min:500|max:1000000',
        ]);

        $pot = Pot::create($user->id, $data['title'], $data['beneficiary'], (int) $data['target']);

        return $this->json([
            'ok'    => true,
            'slug'  => $pot->slug,
            'share' => rtrim(\Transouscris\Core\Config::get('app.url'), '/') . '/cagnotte/' . $pot->slug,
        ]);
    }

    /** Page publique d'une cagnotte (via slug), sans authentification. */
    public function showPublic(Request $request, string $slug): Response
    {
        $pot = Pot::findBySlug($slug);
        if ($pot === null) {
            return $this->view('errors.generic', ['status' => 404, 'message' => 'Cagnotte introuvable.'], layout: 'layouts.public');
        }
        return $this->view('pot.public', [
            'title'    => $pot->title,
            'pot'      => $pot,
            'gateways' => PaymentGatewayFactory::available(),
        ], layout: 'layouts.public');
    }

    /** Contribution à une cagnotte (publique). */
    public function contribute(Request $request, string $slug): Response
    {
        $pot = Pot::findBySlug($slug);
        if ($pot === null || $pot->status === 'closed') {
            return $this->json(['error' => 'Cagnotte indisponible.'], 404);
        }

        $data = Validator::make($request->only(['amount', 'gateway', 'name', 'phone']))->validate([
            'amount'  => 'required|amount|min:100|max:500000',
            'gateway' => 'required|in:' . implode(',', PaymentGatewayFactory::available()),
            'phone'   => 'required|phone_ci',
        ]);

        $result = $this->payments->startPotContribution(
            pot: $pot,
            amount: (int) $data['amount'],
            gateway: $data['gateway'],
            customer: new PaymentContextData(
                phone: $data['phone'],
                name: $request->input('name')
            )
        );

        if (!$result->success) {
            return $this->json(['error' => $result->error ?? 'Paiement impossible.'], 502);
        }
        return $this->json(['ok' => true, 'redirect' => $result->redirectUrl]);
    }
}

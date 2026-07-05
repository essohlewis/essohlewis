<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Config;
use Transouscris\Core\Controller;
use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\PaymentIntent;
use Transouscris\Services\PaymentService;

/**
 * Simulateur de paiement — DÉVELOPPEMENT UNIQUEMENT (APP_DEBUG=true).
 *
 * Remplace la page de paiement d'un fournisseur réel : l'utilisateur confirme
 * ou annule, puis le crédit passe par le circuit normal de PaymentService
 * (re-vérification via SandboxGateway + application idempotente). Toute route
 * de ce contrôleur renvoie 404 hors mode debug.
 */
final class DevPaymentController extends Controller
{
    public function __construct(private PaymentService $payments = new PaymentService()) {}

    private function guardDebug(): void
    {
        if (!Config::get('app.debug')) {
            throw new HttpException(404);
        }
    }

    public function show(Request $request): Response
    {
        $this->guardDebug();
        $intent = $this->intentFromRequest((string) $request->query('ref', ''));

        return $this->view('dev.pay', [
            'title'  => 'Simulateur de paiement',
            'intent' => $intent,
        ], layout: 'layouts.public');
    }

    public function confirm(Request $request): Response
    {
        $this->guardDebug();
        $intent = $this->intentFromRequest((string) $request->input('ref', ''));

        // Marque la simulation comme réussie, puis déclenche le circuit réel.
        $intent->mergeMetadata(['sandbox_status' => 'success']);
        $this->payments->handleConfirmedReference('sandbox', $intent->reference, $intent->reference);

        return $this->redirect('/payment/return?ref=' . urlencode($intent->reference));
    }

    public function cancel(Request $request): Response
    {
        $this->guardDebug();
        $intent = $this->intentFromRequest((string) $request->input('ref', ''));

        $intent->mergeMetadata(['sandbox_status' => 'cancelled']);
        $this->payments->handleConfirmedReference('sandbox', $intent->reference, $intent->reference);

        return $this->redirect('/payment/return?ref=' . urlencode($intent->reference));
    }

    private function intentFromRequest(string $reference): PaymentIntent
    {
        $intent = $reference !== '' ? PaymentIntent::findByReference($reference) : null;
        if ($intent === null || $intent->gateway !== 'sandbox') {
            throw new HttpException(404, 'Paiement de simulation introuvable.');
        }
        return $intent;
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Exceptions\InsufficientFundsException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Validator;
use Transouscris\Models\Plan;
use Transouscris\Services\OperatorDetector;
use Transouscris\Services\RechargeService;

/**
 * Recharge de crédit et souscription de forfaits.
 */
final class RechargeController extends Controller
{
    public function __construct(
        private OperatorDetector $detector = new OperatorDetector(),
        private RechargeService $recharges = new RechargeService()
    ) {}

    public function form(Request $request): Response
    {
        $user = $this->requireUser();

        // Pré-sélection éventuelle transmise par l'assistant du tableau de bord.
        $operator = (string) $request->query('operator', '');
        $type     = (string) $request->query('type', '');

        // Numéro de l'utilisateur au format national (pour le bouton « Moi-même »).
        $myNumber = $this->detector->normalize($user->phone);

        // Pré-remplissage possible depuis l'historique / les favoris.
        $prePhone  = $this->detector->normalize((string) $request->query('phone', '')) ?? '';
        $preAmount = (int) $request->query('amount', 0);

        return $this->view('recharge.form', [
            'title'        => 'Nouvelle recharge',
            'preOperator'  => in_array($operator, ['orange', 'moov', 'mtn'], true) ? $operator : null,
            'preType'      => in_array($type, ['credit', 'internet', 'voice', 'sms', 'mixte', 'transfer'], true) ? $type : null,
            'prePhone'     => $prePhone,
            'preAmount'    => $preAmount > 0 ? $preAmount : null,
            'myNumber'     => $myNumber,
            'recentNumbers'=> $this->recentNumbers($user->id),
            'favorites'    => \Transouscris\Models\Favorite::forUser($user->id),
        ]);
    }

    /** Numéros récemment rechargés par l'utilisateur (accès rapide). */
    private function recentNumbers(int $userId): array
    {
        $stmt = \Transouscris\Core\Database::connection()->prepare(
            'SELECT msisdn, MAX(created_at) AS last
             FROM recharges WHERE user_id = :uid
             GROUP BY msisdn ORDER BY last DESC LIMIT 5'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map(static fn ($r) => $r['msisdn'], $stmt->fetchAll());
    }

    /** Détection d'opérateur (AJAX) au fil de la saisie du numéro. */
    public function detect(Request $request): Response
    {
        $phone  = (string) $request->input('phone', '');
        $result = $this->detector->detect($phone);
        if ($result['operator'] === null) {
            return $this->json(['detected' => false]);
        }
        return $this->json([
            'detected'      => true,
            'operator'      => $result['operator'],
            'authoritative' => $result['authoritative'],
            'msisdn'        => $result['msisdn'],
        ]);
    }

    /** Liste des forfaits d'un opérateur (AJAX), avec sous-catégorie et volume. */
    public function plans(Request $request, string $operator): Response
    {
        $plans = array_map(static fn (Plan $p) => [
            'id'          => $p->id,
            'name'        => $p->name,
            'category'    => $p->category,
            'subcategory' => $p->subcategory,
            'price'       => $p->price,
            'validity'    => $p->validity,
            'data_volume' => $p->dataVolume,
            'minutes'     => $p->minutes,
            'sms'         => $p->smsCount,
            'bonus'       => $p->bonus,
            'ussd'        => $p->ussdCode,
            'description' => $p->description,
        ], Plan::forOperator($operator));

        return $this->json(['plans' => $plans]);
    }

    /** Soumission d'une recharge payée depuis le portefeuille. */
    public function submit(Request $request): Response
    {
        $user = $this->requireUser();

        $data = Validator::make($request->only(['phone', 'operator', 'amount', 'type', 'plan_id']))->validate([
            'phone'    => 'required|phone_ci',
            'operator' => 'required|in:orange,moov,mtn',
            'type'     => 'required|in:credit,internet,voice,sms,mixte,transfer',
        ]);

        $detected = $this->detector->detect($data['phone']);
        if ($detected['msisdn'] === null) {
            return $this->json(['error' => 'Numéro invalide.'], 422);
        }
        $msisdn = $detected['msisdn'];

        $planId = $request->input('plan_id') ? (int) $request->input('plan_id') : null;
        $amount = 0;
        if ($planId === null) {
            $amountData = Validator::make($request->only(['amount']))->validate(['amount' => 'required|amount|min:100|max:100000']);
            $amount = (int) $amountData['amount'];
        }

        try {
            $recharge = $this->recharges->rechargeFromWallet(
                userId: $user->id,
                operatorCode: $data['operator'],
                msisdn: $msisdn,
                amount: $amount,
                type: $data['type'],
                planId: $planId
            );
        } catch (InsufficientFundsException $e) {
            return $this->json([
                'error'     => 'Solde insuffisant. Rechargez votre portefeuille.',
                'available' => $e->available,
            ], 422);
        }

        return $this->json([
            'ok'          => true,
            'recharge_id' => $recharge->id,
            'status'      => $recharge->status,
            'redirect'    => '/recharge/' . $recharge->id . '/receipt',
        ]);
    }

    /** Reçu téléchargeable d'une recharge (avec garde IDOR). */
    public function receipt(Request $request, string $id): Response
    {
        $user     = $this->requireUser();
        $recharge = \Transouscris\Models\Recharge::find((int) $id);
        if ($recharge === null) {
            return $this->view('errors.generic', ['status' => 404, 'message' => 'Recharge introuvable.'], layout: 'layouts.app');
        }
        // Contrôle IDOR : la recharge doit appartenir à l'utilisateur connecté.
        $this->authorizeOwnership($recharge->userId, $user);

        return $this->view('recharge.receipt', [
            'title'    => 'Reçu de recharge',
            'recharge' => $recharge,
        ]);
    }
}

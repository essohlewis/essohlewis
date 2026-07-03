<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Exceptions\InsufficientFundsException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Session;
use Transouscris\Core\Validator;
use Transouscris\Models\ScheduledRecharge;
use Transouscris\Services\OperatorDetector;
use Transouscris\Services\ScheduledRechargeService;

/**
 * Gestion des recharges programmées (récurrentes) de l'utilisateur.
 * Toutes les actions vérifient l'appartenance de la programmation (anti-IDOR).
 */
final class ScheduledRechargeController extends Controller
{
    public function __construct(
        private OperatorDetector $detector = new OperatorDetector(),
        private ScheduledRechargeService $scheduler = new ScheduledRechargeService()
    ) {}

    public function index(Request $request): Response
    {
        $user = $this->requireUser();
        return $this->view('scheduled.index', [
            'title'     => 'Recharges programmées',
            'schedules' => ScheduledRecharge::forUser($user->id),
        ]);
    }

    public function store(Request $request): Response
    {
        $user = $this->requireUser();
        $data = Validator::make($request->only(['phone', 'operator', 'amount', 'frequency']))->validate([
            'phone'     => 'required|phone_ci',
            'operator'  => 'required|in:orange,moov,mtn',
            'amount'    => 'required|amount|min:100|max:100000',
            'frequency' => 'required|in:monthly,weekly',
        ]);

        $msisdn = $this->detector->normalize($data['phone']);
        if ($msisdn === null) {
            return $this->json(['error' => 'Numéro invalide.'], 422);
        }

        ScheduledRecharge::createFor($user->id, $msisdn, $data['operator'], (int) $data['amount'], $data['frequency']);
        Session::flash('success', 'Recharge programmée créée.');
        return $this->json(['ok' => true, 'redirect' => '/programmees']);
    }

    public function toggle(Request $request, string $id): Response
    {
        $schedule = $this->ownedSchedule((int) $id);
        $schedule->setActive(!$schedule->isActive);
        return $this->json(['ok' => true, 'active' => $schedule->isActive]);
    }

    public function destroy(Request $request, string $id): Response
    {
        $schedule = $this->ownedSchedule((int) $id);
        $schedule->delete();
        return $this->json(['ok' => true]);
    }

    /** Exécute immédiatement une programmation (test / déclenchement manuel). */
    public function runNow(Request $request, string $id): Response
    {
        $user     = $this->requireUser();
        $schedule = $this->ownedSchedule((int) $id);
        try {
            $this->scheduler->runNow($user->id, $schedule->id);
        } catch (InsufficientFundsException $e) {
            return $this->json(['error' => 'Solde insuffisant pour exécuter cette recharge.'], 422);
        }
        return $this->json(['ok' => true, 'message' => 'Recharge exécutée.']);
    }

    /** Charge une programmation en garantissant qu'elle appartient à l'utilisateur. */
    private function ownedSchedule(int $id): ScheduledRecharge
    {
        $user     = $this->requireUser();
        $schedule = ScheduledRecharge::find($id);
        if ($schedule === null) {
            throw new \Transouscris\Core\Exceptions\HttpException(404);
        }
        $this->authorizeOwnership($schedule->userId, $user);
        return $schedule;
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\ActivityLog;
use Amoura\Models\Plan;
use Amoura\Models\Transaction;

final class BillingController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'subscriptions.manage');
        $this->view('admin/billing', [
            'plans' => (new Plan())->all(),
            'transactions' => (new Transaction())->recent(30),
            'revenue' => (new Transaction())->revenueStats(),
        ], 'layouts/admin');
    }

    public function savePlan(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'subscriptions.manage');
        $id = (int) $params['id'];
        (new Plan())->update($id, [
            'name' => trim((string) $request->input('name')),
            'description' => trim((string) $request->input('description')),
            'price_cents' => max(0, (int) round((float) $request->input('price') * 100)),
            'currency' => strtoupper(substr((string) $request->input('currency', 'XOF'), 0, 3)),
            'is_active' => $request->input('is_active') ? 1 : 0,
        ]);
        (new ActivityLog())->record((int) $staff['id'], 'plan.update', 'plan', $id, [], $request->ip());
        Session::flash('success', 'Plan mis à jour.');
        $this->redirect('/admin/billing');
    }

    public function refund(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'subscriptions.manage');
        $id = (int) $params['id'];
        // Marque le remboursement localement ; l'exécution réelle se fait via l'API du prestataire.
        (new Transaction())->update($id, ['status' => 'refunded']);
        (new ActivityLog())->record((int) $staff['id'], 'transaction.refund', 'transaction', $id, [], $request->ip());
        Session::flash('success', 'Transaction marquée remboursée. Effectuez le remboursement chez le prestataire.');
        $this->redirect('/admin/billing');
    }
}

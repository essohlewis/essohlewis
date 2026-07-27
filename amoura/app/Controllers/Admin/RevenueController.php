<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Services\Analytics\RevenueAnalytics;

/** Tableau de bord revenus avancé (Phase 3) : MRR, ARPU, LTV, churn, tendances. */
final class RevenueController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'subscriptions.manage');
        $this->view('admin/revenue', [
            'summary' => RevenueAnalytics::summary(),
            'trend' => RevenueAnalytics::monthlyTrend(12),
            'by_gateway' => RevenueAnalytics::byGateway(),
            'by_plan' => RevenueAnalytics::byPlan(),
        ], 'layouts/admin');
    }
}

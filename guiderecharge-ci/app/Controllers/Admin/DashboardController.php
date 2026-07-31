<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Models\Forfait;
use App\Models\Guide;
use App\Models\Log;
use App\Models\Operateur;

/**
 * Tableau de bord admin : statistiques et derniers logs.
 */
final class DashboardController extends Controller
{
    public function index(): void
    {
        Auth::requireAdmin();

        $forfaitModel = new Forfait();
        $logModel = new Log();

        $this->view('admin/dashboard/index', [
            'title' => 'Tableau de bord — Administration',
            'stats' => [
                'forfaits'   => $forfaitModel->count(),
                'operateurs' => (new Operateur())->count(),
                'guides'     => (new Guide())->count(),
                'generations' => $logModel->ussdGenerationCount(),
            ],
            'plusConsultes' => $forfaitModel->plusConsultes(5),
            'logs'          => $logModel->recent(12),
        ], 'admin');
    }
}

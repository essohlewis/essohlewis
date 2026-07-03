<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\Recharge;

/**
 * Historique des transactions de l'utilisateur.
 */
final class HistoryController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->requireUser();
        return $this->view('history.index', [
            'title'   => 'Historique',
            'history' => Recharge::forUser($user->id, 100),
        ]);
    }
}

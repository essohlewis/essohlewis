<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\Recharge;

/**
 * Pages publiques et tableau de bord utilisateur.
 */
final class HomeController extends Controller
{
    public function landing(Request $request): Response
    {
        return $this->view('home.landing', ['title' => 'Transouscris — Recharge mobile & forfaits'], layout: 'layouts.public');
    }

    public function dashboard(Request $request): Response
    {
        $user   = $this->requireUser();
        $wallet = $user->wallet();
        $recent = Recharge::forUser($user->id, 10);

        return $this->view('home.dashboard', [
            'title'   => 'Tableau de bord',
            'wallet'  => $wallet,
            'recent'  => $recent,
        ]);
    }
}

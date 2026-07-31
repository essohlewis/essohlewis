<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\CategorieForfait;
use App\Models\CodeUssd;
use App\Models\Forfait;
use App\Models\Operateur;

/**
 * Page d'accueil : hero, forfaits populaires, codes essentiels, accès rapides.
 */
final class HomeController extends Controller
{
    public function index(): void
    {
        $operateurModel = new Operateur();
        $forfaitModel = new Forfait();
        $codeModel = new CodeUssd();
        $categorieModel = new CategorieForfait();

        $this->view('home/index', [
            'title'       => 'GuideRecharge CI — Comparez forfaits et codes USSD',
            'operateurs'  => $operateurModel->actifs(),
            'populaires'  => $forfaitModel->populaires(6),
            'categories'  => $categorieModel->ordered(),
            'codesEssentiels' => $codeModel->essentielsParOperateur(),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\Marche;

class HomeController extends Controller
{
    /** Page d'accueil : présentation + choix de l'espace + marchés actifs. */
    public function index(): void
    {
        $marches = (new Marche())->tousActifs();
        $this->rendre('home/index', [
            'titre'   => 'Accueil',
            'marches' => $marches,
        ]);
    }
}

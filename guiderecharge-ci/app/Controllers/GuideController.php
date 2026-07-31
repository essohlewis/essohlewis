<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\Guide;
use App\Models\Operateur;

/**
 * Guides & informations : procédures pas-à-pas, numéros utiles, réclamations.
 */
final class GuideController extends Controller
{
    /** Liste des guides, filtrable par catégorie. */
    public function index(): void
    {
        $guideModel = new Guide();
        $categorie = (string) $this->request->query('categorie', '');

        $this->view('guides/index', [
            'title'      => 'Guides & procédures — GuideRecharge CI',
            'guides'     => $guideModel->actifs($categorie !== '' ? $categorie : null),
            'categories' => $guideModel->categories(),
            'filtreCat'  => $categorie,
        ]);
    }

    /** Détail d'un guide par slug. */
    public function show(string $slug): void
    {
        $guideModel = new Guide();
        $guide = $guideModel->findBySlug($slug);

        if ($guide === null) {
            $this->view('errors/404', ['title' => 'Guide introuvable']);
            return;
        }

        $guideModel->incrementVues((int) $guide['id']);

        $this->view('guides/show', [
            'title' => $guide['titre'] . ' — Guides',
            'guide' => $guide,
            'autres' => array_slice($guideModel->actifs(), 0, 5),
        ]);
    }
}

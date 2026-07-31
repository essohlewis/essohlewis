<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\CategorieForfait;
use App\Models\CodeUssd;
use App\Models\Forfait;
use App\Models\Operateur;

/**
 * Catalogue des forfaits : liste filtrable, endpoint JSON pour filtres AJAX,
 * et page de détail d'un forfait.
 */
final class ForfaitController extends Controller
{
    /** Page catalogue (rendu serveur initial + hydratation JS). */
    public function index(): void
    {
        $forfaitModel = new Forfait();
        $operateurModel = new Operateur();
        $categorieModel = new CategorieForfait();

        $filters = $this->readFilters();

        $this->view('forfaits/index', [
            'title'      => 'Catalogue des forfaits — GuideRecharge CI',
            'forfaits'   => $forfaitModel->filter($filters),
            'operateurs' => $operateurModel->actifs(),
            'categories' => $categorieModel->ordered(),
            'filters'    => $filters,
        ]);
    }

    /**
     * Endpoint JSON consommé par le filtre dynamique (fetch, sans rechargement).
     */
    public function apiList(): void
    {
        $forfaitModel = new Forfait();
        $filters = $this->readFilters();
        $forfaits = $forfaitModel->filter($filters);

        // On ne renvoie que les champs utiles à l'affichage des cartes.
        $data = array_map(static function (array $f): array {
            return [
                'id'               => (int) $f['id'],
                'nom'              => $f['nom'],
                'description'      => $f['description'],
                'prix'            => (int) $f['prix'],
                'volume_data'      => $f['volume_data'],
                'minutes_appel'    => $f['minutes_appel'],
                'sms'              => $f['sms'],
                'validite'         => $f['validite'],
                'code_ussd'        => $f['code_ussd'],
                'populaire'        => (int) $f['populaire'],
                'operateur_nom'    => $f['operateur_nom'],
                'operateur_slug'   => $f['operateur_slug'],
                'operateur_couleur' => $f['operateur_couleur'],
                'categorie_nom'    => $f['categorie_nom'],
                'categorie_slug'   => $f['categorie_slug'],
            ];
        }, $forfaits);

        $this->json(['count' => count($data), 'forfaits' => $data]);
    }

    /** Détail d'un forfait. */
    public function show(string $id): void
    {
        $forfaitModel = new Forfait();
        $forfait = $forfaitModel->detail((int) $id);

        if ($forfait === null) {
            $this->view('errors/404', ['title' => 'Forfait introuvable'], 'main');
            return;
        }

        $forfaitModel->incrementVues((int) $id);

        // Code USSD d'activation du forfait, si présent, + codes de l'opérateur.
        $codeModel = new CodeUssd();

        $this->view('forfaits/show', [
            'title'    => $forfait['nom'] . ' — ' . $forfait['operateur_nom'],
            'forfait'  => $forfait,
            'codes'    => $codeModel->forOperateur($forfait['operateur_slug']),
        ]);
    }

    /**
     * Lit et normalise les filtres depuis la query string.
     *
     * @return array<string, mixed>
     */
    private function readFilters(): array
    {
        return [
            'operateur' => (string) ($this->request->query('operateur', '')),
            'categorie' => (string) ($this->request->query('categorie', '')),
            'prix_min'  => $this->request->query('prix_min', ''),
            'prix_max'  => $this->request->query('prix_max', ''),
            'sort'      => (string) ($this->request->query('sort', 'populaire')),
            'actif_only' => true,
        ];
    }
}

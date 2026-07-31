<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\Forfait;
use App\Models\Operateur;
use App\Models\CategorieForfait;

/**
 * Comparateur de forfaits (2 à 3 côte à côte, calcul du prix au Go).
 */
final class CompareController extends Controller
{
    public function index(): void
    {
        $forfaitModel = new Forfait();
        $operateurModel = new Operateur();
        $categorieModel = new CategorieForfait();

        // Les IDs sélectionnés peuvent venir de ?ids=1,2,3
        $ids = $this->parseIds((string) $this->request->query('ids', ''));
        $selection = $ids !== [] ? $forfaitModel->whereIn($ids) : [];

        $this->view('compare/index', [
            'title'      => 'Comparateur de forfaits — GuideRecharge CI',
            'selection'  => $this->withPrixAuGo($selection),
            'forfaits'   => $forfaitModel->filter(['sort' => 'prix_asc']),
            'operateurs' => $operateurModel->actifs(),
            'categories' => $categorieModel->ordered(),
        ]);
    }

    /**
     * Endpoint JSON du comparateur (jusqu'à 3 forfaits).
     */
    public function apiCompare(): void
    {
        $ids = $this->parseIds((string) $this->request->query('ids', ''));
        $ids = array_slice($ids, 0, 3);

        $forfaitModel = new Forfait();
        $forfaits = $this->withPrixAuGo($forfaitModel->whereIn($ids));

        // Détermine le meilleur rapport prix/Go (plus petit prix au Go > 0).
        $meilleurId = null;
        $meilleurPrixGo = null;
        foreach ($forfaits as $f) {
            if ($f['prix_au_go'] !== null && ($meilleurPrixGo === null || $f['prix_au_go'] < $meilleurPrixGo)) {
                $meilleurPrixGo = $f['prix_au_go'];
                $meilleurId = (int) $f['id'];
            }
        }

        $this->json([
            'forfaits'    => $forfaits,
            'meilleur_id' => $meilleurId,
        ]);
    }

    /**
     * Ajoute le prix au Go calculé à chaque forfait.
     *
     * @param array<int, array<string, mixed>> $forfaits
     * @return array<int, array<string, mixed>>
     */
    private function withPrixAuGo(array $forfaits): array
    {
        foreach ($forfaits as &$f) {
            $go = $this->extractGo((string) ($f['volume_data'] ?? ''));
            $prix = (int) $f['prix'];
            // Prix au Go : arrondi à l'entier FCFA, null si pas de data.
            $f['go'] = $go;
            $f['prix_au_go'] = ($go !== null && $go > 0) ? (int) round($prix / $go) : null;
        }
        unset($f);
        return $forfaits;
    }

    /**
     * Extrait le volume en Go à partir d'un libellé « 5 Go », « 500 Mo », etc.
     */
    private function extractGo(string $volume): ?float
    {
        if ($volume === '') {
            return null;
        }
        // Cherche un nombre suivi de l'unité Go/Mo (insensible à la casse).
        if (preg_match('/([\d]+(?:[.,]\d+)?)\s*(go|mo)/i', $volume, $m)) {
            $valeur = (float) str_replace(',', '.', $m[1]);
            $unite = strtolower($m[2]);
            return $unite === 'mo' ? $valeur / 1024 : $valeur;
        }
        return null;
    }

    /**
     * Convertit « 1,2,3 » en liste d'entiers uniques.
     *
     * @return list<int>
     */
    private function parseIds(string $raw): array
    {
        if ($raw === '') {
            return [];
        }
        $ids = array_map('intval', explode(',', $raw));
        return array_values(array_unique(array_filter($ids, static fn ($i) => $i > 0)));
    }
}

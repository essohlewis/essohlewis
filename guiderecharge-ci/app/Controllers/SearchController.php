<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\CodeUssd;
use App\Models\Forfait;
use App\Models\Guide;

/**
 * Recherche globale : forfaits + guides + codes USSD, résultats catégorisés.
 */
final class SearchController extends Controller
{
    public function index(): void
    {
        $term = trim((string) $this->request->query('q', ''));
        $results = ['forfaits' => [], 'guides' => [], 'codes' => []];

        if ($term !== '' && mb_strlen($term) >= 2) {
            $results['forfaits'] = (new Forfait())->search($term);
            $results['guides']   = (new Guide())->search($term);
            $results['codes']    = (new CodeUssd())->search($term);
        }

        $this->view('search/index', [
            'title'   => $term !== '' ? "Recherche : {$term}" : 'Recherche',
            'term'    => $term,
            'results' => $results,
            'total'   => count($results['forfaits']) + count($results['guides']) + count($results['codes']),
        ]);
    }

    /** Endpoint JSON pour la recherche instantanée (barre globale). */
    public function api(): void
    {
        $term = trim((string) $this->request->query('q', ''));
        if ($term === '' || mb_strlen($term) < 2) {
            $this->json(['forfaits' => [], 'guides' => [], 'codes' => []]);
        }

        $this->json([
            'forfaits' => array_map(static fn ($f) => [
                'id'   => (int) $f['id'],
                'nom'  => $f['nom'],
                'operateur' => $f['operateur_nom'],
                'prix' => (int) $f['prix'],
            ], (new Forfait())->search($term, 5)),
            'guides' => array_map(static fn ($g) => [
                'slug'  => $g['slug'],
                'titre' => $g['titre'],
            ], (new Guide())->search($term, 5)),
            'codes' => array_map(static fn ($c) => [
                'libelle' => $c['libelle'],
                'pattern' => $c['pattern'],
                'operateur' => $c['operateur_nom'],
            ], (new CodeUssd())->search($term, 5)),
        ]);
    }
}

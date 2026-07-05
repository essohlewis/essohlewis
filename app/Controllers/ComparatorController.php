<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Database;
use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Comparateur de forfaits internet entre MTN, Orange et Moov.
 * Calcule le coût par Go et met en évidence le meilleur rapport qualité/prix.
 */
final class ComparatorController extends Controller
{
    public function index(Request $request): Response
    {
        $rows = Database::connection()->query(
            "SELECT operator_code, name, subcategory, price, validity, data_volume
             FROM plans
             WHERE active = 1 AND category = 'internet' AND data_volume IS NOT NULL
             ORDER BY price ASC"
        )->fetchAll();

        $items = [];
        foreach ($rows as $r) {
            $go = $this->toGigabytes((string) $r['data_volume']);
            $items[] = [
                'operator'    => $r['operator_code'],
                'name'        => $r['name'],
                'subcategory' => $r['subcategory'],
                'price'       => (int) $r['price'],
                'validity'    => $r['validity'],
                'volume'      => $r['data_volume'],
                'go'          => $go,
                'cost_per_go' => $go > 0 ? (int) round($r['price'] / $go) : null,
            ];
        }

        // Meilleur rapport qualité/prix = plus faible coût par Go (hors illimité).
        $bestCostPerGo = null;
        foreach ($items as $it) {
            if ($it['cost_per_go'] !== null) {
                $bestCostPerGo = $bestCostPerGo === null
                    ? $it['cost_per_go']
                    : min($bestCostPerGo, $it['cost_per_go']);
            }
        }

        // Tri par coût/Go croissant (les illimités en fin de liste).
        usort($items, static function ($a, $b) {
            $ca = $a['cost_per_go'] ?? PHP_INT_MAX;
            $cb = $b['cost_per_go'] ?? PHP_INT_MAX;
            return $ca <=> $cb;
        });

        return $this->view('comparator.index', [
            'title'          => 'Comparateur de forfaits',
            'items'          => $items,
            'bestCostPerGo'  => $bestCostPerGo,
        ]);
    }

    /**
     * Convertit un volume texte ("1 Go", "500 Mo", "1,5 Go", "Illimité") en Go.
     * Retourne 0 pour un volume non chiffrable (illimité).
     */
    private function toGigabytes(string $volume): float
    {
        $v = str_replace(',', '.', strtolower(trim($volume)));
        if (str_contains($v, 'illim')) {
            return 0.0;
        }
        if (!preg_match('/([\d.]+)\s*(go|mo)/', $v, $m)) {
            return 0.0;
        }
        $value = (float) $m[1];
        return $m[2] === 'mo' ? $value / 1024 : $value;
    }
}

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

    /** Export CSV (compatible Excel) de l'historique de l'utilisateur. */
    public function exportCsv(Request $request): Response
    {
        $user = $this->requireUser();
        $rows = Recharge::forUser($user->id, 1000);

        $out = fopen('php://temp', 'r+');
        // BOM UTF-8 pour un affichage correct des accents dans Excel.
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Date', 'Opérateur', 'Type', 'Numéro', 'Montant (F CFA)', 'Statut'], ';');
        foreach ($rows as $r) {
            fputcsv($out, [
                $r->createdAt, strtoupper($r->operatorCode), $r->type, $r->msisdn, $r->amount, $r->status,
            ], ';');
        }
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        return (new Response())->download($csv, 'historique-transouscris.csv', 'text/csv; charset=utf-8');
    }
}

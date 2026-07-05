<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Config;
use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Informations opérateurs : codes USSD utiles et règles de service.
 * Les données proviennent du référentiel config/operators.php.
 */
final class OperatorController extends Controller
{
    /** Libellés lisibles des clés de codes USSD. */
    private const USSD_LABELS = [
        'solde_credit'    => 'Consulter le solde crédit',
        'recharge'        => 'Recharger du crédit',
        'internet'        => 'Forfaits internet',
        'solde_data'      => 'Consulter le solde data',
        'forfaits_voix'   => 'Forfaits appels',
        'forfaits_sms'    => 'Forfaits SMS',
        'moov_folie'      => 'Moov Folie (internet)',
        'moov_folie_nuit' => 'Moov Folie Nuit',
        'packs'           => 'Packs (Free)',
        'transfert'       => 'Transfert de crédit',
        'mobile_money'    => 'Mobile Money',
        'service_client'  => 'Service client',
    ];

    public function codes(Request $request): Response
    {
        return $this->view('operator.codes', [
            'title'     => 'Codes utiles',
            'operators' => Config::get('operators.operators', []),
            'labels'    => self::USSD_LABELS,
        ]);
    }
}

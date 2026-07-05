<?php

declare(strict_types=1);

/**
 * Référentiel des opérateurs mobiles ivoiriens.
 *
 * Contient, pour chaque opérateur :
 *   - métadonnées (nom, couleur de marque) ;
 *   - codes USSD PUBLICS réels (source : sites officiels des opérateurs) ;
 *   - règles métier (transfert de crédit autorisé, min/max, jours bonus).
 *
 * IMPORTANT : la détection par préfixe reste un fallback ; la portabilité des
 * numéros (MNP) impose une vérification HLR en production (voir OperatorDetector).
 * Mapping du cahier des charges Transouscris : 07→Orange | 01→Moov | 05→MTN.
 *
 * Codes USSD vérifiés (sept. 2024, sujets à évolution — à valider auprès des
 * opérateurs) : Orange *144# (internet), MTN *105*2# (internet) / *111*...#
 * (Me2U), Moov *303*2# (Moov Folie) / *102*...# (transfert).
 */

return [
    'country_code'    => '225',
    'national_length' => 10,

    'prefixes' => [
        '07' => 'orange',
        '01' => 'moov',
        '05' => 'mtn',
    ],

    'operators' => [
        'orange' => [
            'code'  => 'orange',
            'name'  => 'Orange CI',
            'color' => '#FF7900',
            'app'   => 'Max it / Orange et Moi',
            'ussd'  => [
                'solde_credit'   => '#123#',
                'recharge'       => '#123*<code>#',
                'internet'       => '*144#',
                'solde_data'     => '*144*3#',
                'forfaits_voix'  => '*144#',
                'transfert'      => '#144#',
                'service_client' => '900',
            ],
            'rules' => [
                'transfer_enabled' => true,
                'transfer_min'     => 200,
                'transfer_max'     => 50000,
                'self_transfer'    => false,   // transfert vers soi interdit
                'bonus_days'       => [],
            ],
        ],
        'mtn' => [
            'code'  => 'mtn',
            'name'  => 'MTN CI',
            'color' => '#FFCC00',
            'app'   => 'myMTN / moninternet.mtn.ci',
            'ussd'  => [
                'solde_credit'   => '#100#',
                'recharge'       => '*100*<code>#',
                'internet'       => '*105*2#',
                'forfaits_sms'   => '*105*3#',
                'packs'          => '*105*1#',
                'transfert'      => '*111*<num>*<montant>*<code>#',   // Me2U
                'mobile_money'   => '*133#',
                'service_client' => '111',
            ],
            'rules' => [
                'transfer_enabled' => true,
                'transfer_min'     => 100,
                'transfer_max'     => 50000,
                'self_transfer'    => false,
                'bonus_days'       => ['mardi'],  // +100% le mardi sur 500/1000/2000 F
            ],
        ],
        'moov' => [
            'code'  => 'moov',
            'name'  => 'Moov Africa CI',
            'color' => '#004B9F',
            'app'   => 'Moov Africa / Moov Money',
            'ussd'  => [
                'solde_credit'   => '*105#',
                'recharge'       => '*145*<code>#',
                'internet'       => '*303*3*1#',
                'solde_data'     => '*303*3*2*1#',
                'moov_folie'     => '*303*2#',
                'moov_folie_nuit'=> '*303*2*1*7#',
                'forfaits_voix'  => '*303*1#',   // Izy heures+
                'forfaits_sms'   => '*366#',
                'transfert'      => '*102*<montant>*<num>*<code>#',
                'mobile_money'   => '*155#',
                'service_client' => '155',
            ],
            'rules' => [
                'transfer_enabled' => true,
                'transfer_min'     => 100,
                'transfer_max'     => 50000,
                'self_transfer'    => false,
                'bonus_days'       => ['lundi', 'mardi'],  // internet doublé
            ],
        ],
    ],
];

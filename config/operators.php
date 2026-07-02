<?php

declare(strict_types=1);

/**
 * Table de correspondance préfixe → opérateur pour la détection automatique.
 *
 * IMPORTANT : la détection par préfixe est un fallback. En production, la
 * portabilité des numéros (MNP) impose une vérification HLR. Le service
 * Transouscris\Services\OperatorDetector expose un point d'extension
 * `resolveViaHlr()` prêt à être branché sur un fournisseur HLR.
 *
 * Mapping fourni par le cahier des charges Transouscris :
 *   07 → Orange | 01 → Moov | 05 → MTN
 */

return [
    // Numéros ivoiriens : 10 chiffres, préfixe à 2 chiffres.
    'country_code'   => '225',
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
        ],
        'moov' => [
            'code'  => 'moov',
            'name'  => 'Moov Africa',
            'color' => '#004B9F',
        ],
        'mtn' => [
            'code'  => 'mtn',
            'name'  => 'MTN CI',
            'color' => '#FFCC00',
        ],
    ],
];

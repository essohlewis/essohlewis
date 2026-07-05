<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Config;

/**
 * Détection de l'opérateur mobile d'un numéro ivoirien.
 *
 * Deux niveaux :
 *   1. Détection par PRÉFIXE (rapide, hors-ligne) — mapping du cahier des charges :
 *      07 → Orange | 01 → Moov | 05 → MTN.
 *   2. Point d'extension resolveViaHlr() pour un lookup HLR en production,
 *      indispensable à cause de la portabilité des numéros (MNP).
 *
 * La détection par préfixe est retournée avec un indicateur `authoritative=false`
 * tant qu'un HLR n'a pas confirmé.
 */
final class OperatorDetector
{
    /** @var callable|null résolveur HLR injectable (msisdn) => ?string operatorCode */
    private $hlrResolver;

    public function __construct(?callable $hlrResolver = null)
    {
        $this->hlrResolver = $hlrResolver;
    }

    /**
     * Normalise un numéro saisi vers le format national à 10 chiffres.
     * Accepte +2250700000000, 002250700..., 0700000000, 0700 00 00 00.
     */
    public function normalize(string $input): ?string
    {
        $digits = preg_replace('/\D+/', '', $input) ?? '';
        $cc     = Config::get('operators.country_code', '225');
        $len    = (int) Config::get('operators.national_length', 10);

        if (str_starts_with($digits, '00' . $cc)) {
            $digits = substr($digits, strlen('00' . $cc));
        } elseif (str_starts_with($digits, $cc) && strlen($digits) === strlen($cc) + $len) {
            $digits = substr($digits, strlen($cc));
        }

        return strlen($digits) === $len ? $digits : null;
    }

    /**
     * @return array{operator:?string, authoritative:bool, msisdn:?string}
     */
    public function detect(string $input): array
    {
        $msisdn = $this->normalize($input);
        if ($msisdn === null) {
            return ['operator' => null, 'authoritative' => false, 'msisdn' => null];
        }

        // Priorité au HLR si disponible (fait autorité).
        if ($this->hlrResolver !== null) {
            $viaHlr = ($this->hlrResolver)($msisdn);
            if (is_string($viaHlr) && $viaHlr !== '') {
                return ['operator' => $viaHlr, 'authoritative' => true, 'msisdn' => $msisdn];
            }
        }

        $prefixes = Config::get('operators.prefixes', []);
        $prefix   = substr($msisdn, 0, 2);
        $operator = $prefixes[$prefix] ?? null;

        return [
            'operator'      => $operator,
            'authoritative' => false,
            'msisdn'        => $msisdn,
        ];
    }

    /**
     * Format E.164 sans « + » pour les passerelles (ex: 0700000000 → 2250700000000).
     * Les numéros ivoiriens conservent le 0 initial dans le format international.
     */
    public function toE164(string $msisdn): string
    {
        $cc = Config::get('operators.country_code', '225');
        return $cc . $msisdn;
    }
}

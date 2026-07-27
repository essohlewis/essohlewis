<?php
declare(strict_types=1);

namespace Amoura\Services\Money;

/**
 * Conversion et formatage de montants entre devises (Phase 5, Sprint +16).
 * Pur : opère sur des taux fournis (unités de la devise pour 1 unité de base XOF).
 */
final class CurrencyConverter
{
    /**
     * Convertit un montant d'une devise vers une autre.
     * @param float $amount montant dans la devise `from`
     * @param array<string,float> $rates code => unités pour 1 base (XOF)
     */
    public static function convert(float $amount, string $from, string $to, array $rates): float
    {
        $rFrom = (float) ($rates[strtoupper($from)] ?? 0.0);
        $rTo = (float) ($rates[strtoupper($to)] ?? 0.0);
        if ($rFrom <= 0.0 || $rTo <= 0.0) {
            return $amount; // devise inconnue → pas de conversion
        }
        $base = $amount / $rFrom;   // ramène à la base (XOF)
        return $base * $rTo;
    }

    /**
     * Formate un montant selon les métadonnées d'une devise.
     * @param array{symbol?:string,decimals?:int|string,symbol_before?:int|bool,code?:string} $meta
     */
    public static function format(float $amount, array $meta): string
    {
        $decimals = (int) ($meta['decimals'] ?? 2);
        $symbol = (string) ($meta['symbol'] ?? ($meta['code'] ?? ''));
        $before = (bool) ($meta['symbol_before'] ?? false);

        $number = number_format($amount, $decimals, ',', ' ');
        return $before ? ($symbol . ' ' . $number) : ($number . ' ' . $symbol);
    }
}

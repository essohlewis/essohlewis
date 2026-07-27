<?php
declare(strict_types=1);

namespace Amoura\Services\Money;

use Amoura\Models\Currency;

/**
 * Devise d'affichage courante (Phase 5, Sprint +16).
 * Lue depuis le cookie « amoura_currency » (comme la langue), avec repli sur la
 * devise de base. Met en cache la liste des devises pour la durée de la requête.
 */
final class CurrencyContext
{
    private static ?array $all = null;
    private static ?string $current = null;

    /** @return array<int,array> devises actives (métadonnées). */
    public static function available(): array
    {
        return self::$all ??= (new Currency())->active();
    }

    /** @return array<string,float> code => taux pour 1 XOF. */
    public static function rates(): array
    {
        $rates = [];
        foreach (self::available() as $c) {
            $rates[$c['code']] = (float) $c['rate_to_base'];
        }
        return $rates ?: [Currency::BASE => 1.0];
    }

    /** Code de la devise d'affichage courante (valide et active). */
    public static function current(): string
    {
        if (self::$current !== null) {
            return self::$current;
        }
        $cookie = strtoupper((string) ($_COOKIE['amoura_currency'] ?? ''));
        $codes = array_column(self::available(), 'code');
        return self::$current = (in_array($cookie, $codes, true)) ? $cookie : Currency::BASE;
    }

    /** Métadonnées de la devise courante. */
    public static function meta(?string $code = null): array
    {
        $code = strtoupper($code ?? self::current());
        foreach (self::available() as $c) {
            if ($c['code'] === $code) {
                return $c;
            }
        }
        return ['code' => Currency::BASE, 'symbol' => 'FCFA', 'decimals' => 0, 'symbol_before' => 0];
    }

    /** Vrai si le code correspond à une devise active. */
    public static function isValid(string $code): bool
    {
        return in_array(strtoupper($code), array_column(self::available(), 'code'), true);
    }

    /**
     * Convertit un prix (en centimes, devise de base par défaut) vers la devise
     * courante et le formate. Préfixe « ≈ » quand il s'agit d'une conversion.
     */
    public static function display(int $cents, string $base = Currency::BASE): string
    {
        $to = self::current();
        $amount = CurrencyConverter::convert($cents / 100, $base, $to, self::rates());
        $formatted = CurrencyConverter::format($amount, self::meta($to));
        return $to === strtoupper($base) ? $formatted : ('≈ ' . $formatted);
    }

    /** Réinitialise le cache (tests). */
    public static function reset(): void
    {
        self::$all = null;
        self::$current = null;
    }
}

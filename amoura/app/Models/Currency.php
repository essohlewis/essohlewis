<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Devises de conversion (base XOF) — Phase 5, Sprint +16. */
final class Currency extends Model
{
    protected string $table = 'currency_rates';

    /** Devise de référence (les prix des offres sont stockés en XOF). */
    public const BASE = 'XOF';

    /** Toutes les devises actives, ordonnées. */
    public function active(): array
    {
        return $this->run(
            'SELECT code, name, symbol, rate_to_base, decimals, symbol_before
             FROM currency_rates WHERE is_active = 1 ORDER BY position ASC, code ASC'
        )->fetchAll();
    }

    /** Métadonnées d'une devise (ou null si inconnue/inactive). */
    public function find(int|string $code): ?array
    {
        $row = $this->run(
            'SELECT code, name, symbol, rate_to_base, decimals, symbol_before
             FROM currency_rates WHERE code = ? AND is_active = 1 LIMIT 1',
            [strtoupper((string) $code)]
        )->fetch();
        return $row ?: null;
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Core\Observability;

/**
 * Contexte de requête pour la corrélation (Phase 6, Sprint +13).
 * Porte un identifiant de requête unique (X-Request-Id) propagé dans tous les
 * logs et renvoyé au client, plus l'horodatage de départ pour mesurer la durée.
 */
final class RequestContext
{
    private static ?string $id = null;
    private static float $start = 0.0;

    /**
     * Démarre le contexte. Réutilise un identifiant fourni en amont
     * (proxy/load-balancer via X-Request-Id) s'il est plausible, sinon en génère un.
     */
    public static function begin(?string $incoming = null): string
    {
        self::$start = microtime(true);
        $incoming = $incoming !== null ? trim($incoming) : '';
        self::$id = ($incoming !== '' && preg_match('/^[A-Za-z0-9._-]{8,128}$/', $incoming))
            ? $incoming
            : self::generate();
        return self::$id;
    }

    /** Identifiant courant (le génère à la volée si begin() n'a pas été appelé). */
    public static function id(): string
    {
        return self::$id ??= self::generate();
    }

    /** Vrai si un contexte a explicitement été démarré. */
    public static function started(): bool
    {
        return self::$id !== null;
    }

    /** Durée écoulée depuis begin(), en millisecondes. */
    public static function durationMs(): float
    {
        return self::$start > 0.0 ? (microtime(true) - self::$start) * 1000 : 0.0;
    }

    /** Réinitialise (tests). */
    public static function reset(): void
    {
        self::$id = null;
        self::$start = 0.0;
    }

    /** UUID v4 (aléatoire) — sans dépendance externe. */
    private static function generate(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); // version 4
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); // variant
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}

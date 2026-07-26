<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Pagination par curseur (keyset) — Sprint +6.
 * Curseur opaque encodant le dernier identifiant vu ; plus stable et performant
 * que OFFSET sur de grands ensembles (pas de décalage quand des lignes changent).
 */
final class Paginator
{
    /** Encode un id en curseur opaque (base64url). */
    public static function encode(int $id): string
    {
        return rtrim(strtr(base64_encode('id:' . $id), '+/', '-_'), '=');
    }

    /** Décode un curseur ; renvoie 0 si absent ou invalide. */
    public static function decode(?string $cursor): int
    {
        if ($cursor === null || $cursor === '') {
            return 0;
        }
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        if ($decoded === false || !str_starts_with($decoded, 'id:')) {
            return 0;
        }
        return max(0, (int) substr($decoded, 3));
    }

    /**
     * Construit une page à partir de lignes triées par id décroissant.
     * @param array    $rows   lignes récupérées (au plus $limit + 1 idéalement)
     * @param int      $limit  taille de page
     * @param callable $idOf   fn(array $row): int
     * @return array{data:array, next_cursor:?string, has_more:bool}
     */
    public static function page(array $rows, int $limit, callable $idOf): array
    {
        $hasMore = count($rows) > $limit;
        $data = $hasMore ? array_slice($rows, 0, $limit) : $rows;
        $next = null;
        if ($hasMore && $data) {
            $next = self::encode((int) $idOf($data[count($data) - 1]));
        }
        return ['data' => $data, 'next_cursor' => $next, 'has_more' => $hasMore];
    }
}

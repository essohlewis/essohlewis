<?php
/* ==========================================================================
   core/Pagination.php — Pagination optionnelle des listes.
   Non-intrusive : si ?page et ?parPage ne sont pas fournis, la liste est
   renvoyée entière (compatibilité avec l'hydratation du front). L'en-tête
   X-Total-Count expose toujours le total (exposé via CORS).
   ========================================================================== */

class Pagination
{
    public static function paginer(array $items): array
    {
        header('X-Total-Count: ' . count($items));
        $page    = (int) Request::query('page', 0);
        $parPage = (int) Request::query('parPage', 0);
        if ($page < 1 || $parPage < 1) {
            return $items; // pagination non demandée → liste complète
        }
        $parPage = min($parPage, 100); // borne haute de sécurité
        return array_slice($items, ($page - 1) * $parPage, $parPage);
    }
}

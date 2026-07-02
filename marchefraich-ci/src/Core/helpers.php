<?php
/**
 * Fonctions utilitaires globales utilisées dans les vues.
 */

declare(strict_types=1);

if (!function_exists('e')) {
    /** Échappe une valeur pour affichage HTML (protection XSS). */
    function e(?string $valeur): string
    {
        return htmlspecialchars((string) $valeur, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('xof')) {
    /** Formate un montant en Francs CFA : 12500 -> "12 500 FCFA". */
    function xof(int|float $montant): string
    {
        return number_format((float) $montant, 0, ',', ' ') . ' FCFA';
    }
}

if (!function_exists('asset')) {
    /** URL d'une ressource statique en tenant compte du base_url. */
    function asset(string $chemin): string
    {
        global $APP_BASE_URL;
        $base = rtrim((string) ($APP_BASE_URL ?? ''), '/');
        return $base . '/' . ltrim($chemin, '/');
    }
}

if (!function_exists('lien')) {
    /** URL interne (route) en tenant compte du base_url. */
    function lien(string $chemin): string
    {
        return asset($chemin);
    }
}

if (!function_exists('libelleStatut')) {
    /** Libellé lisible d'un statut de commande. */
    function libelleStatut(string $statut): string
    {
        return [
            'recue'          => 'Reçue',
            'en_preparation' => 'En préparation',
            'en_livraison'   => 'En livraison',
            'livree'         => 'Livrée',
            'annulee'        => 'Annulée',
        ][$statut] ?? $statut;
    }
}

if (!function_exists('libelleMethode')) {
    function libelleMethode(string $methode): string
    {
        return [
            'orange_money' => 'Orange Money',
            'mtn_money'    => 'MTN Money',
            'wave'         => 'Wave',
            'especes'      => 'Espèces à la livraison',
        ][$methode] ?? $methode;
    }
}

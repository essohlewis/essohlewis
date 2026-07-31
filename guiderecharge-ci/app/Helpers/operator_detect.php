<?php

declare(strict_types=1);

/**
 * Détection de l'opérateur mobile à partir d'un numéro ivoirien.
 *
 * Préfixes Côte d'Ivoire (2025) :
 *   - Orange : 07
 *   - Moov   : 01
 *   - MTN    : 05
 *
 * Cette logique est dupliquée côté JavaScript (app.js) pour un retour
 * instantané, mais reste ici la référence côté serveur (jamais confiance
 * au seul JS).
 */

if (!function_exists('detect_operateur_slug')) {
    /**
     * Retourne le slug de l'opérateur ('orange', 'mtn', 'moov') ou null.
     *
     * Accepte les numéros au format 10 chiffres (0X XX XX XX XX) ou avec
     * indicatif +225 / 00225.
     */
    function detect_operateur_slug(string $numero): ?string
    {
        // Nettoyage : ne garder que les chiffres.
        $digits = preg_replace('/\D+/', '', $numero) ?? '';

        // Retire l'indicatif pays éventuel (225).
        if (str_starts_with($digits, '00225')) {
            $digits = substr($digits, 5);
        } elseif (str_starts_with($digits, '225')) {
            $digits = substr($digits, 3);
        }

        // Un numéro mobile ivoirien valide comporte 10 chiffres.
        if (strlen($digits) !== 10) {
            return null;
        }

        $prefixe = substr($digits, 0, 2);

        return match ($prefixe) {
            '07'    => 'orange',
            '05'    => 'mtn',
            '01'    => 'moov',
            default => null,
        };
    }
}

if (!function_exists('numero_valide')) {
    /**
     * Vérifie qu'un numéro correspond à un mobile ivoirien à 10 chiffres.
     */
    function numero_valide(string $numero): bool
    {
        return detect_operateur_slug($numero) !== null;
    }
}

if (!function_exists('numero_normalise')) {
    /**
     * Normalise un numéro en 10 chiffres (sans indicatif ni espaces).
     */
    function numero_normalise(string $numero): string
    {
        $digits = preg_replace('/\D+/', '', $numero) ?? '';
        if (str_starts_with($digits, '00225')) {
            $digits = substr($digits, 5);
        } elseif (str_starts_with($digits, '225')) {
            $digits = substr($digits, 3);
        }
        return $digits;
    }
}

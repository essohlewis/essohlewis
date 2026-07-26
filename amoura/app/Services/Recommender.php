<?php
declare(strict_types=1);

namespace Amoura\Services;

/**
 * Score d'affinité pour la découverte (feuille de route — Phase 2).
 *
 * Combine intérêts partagés, proximité géographique, proximité d'âge, activité
 * récente, présence en ligne et badge vérifié en un score unique servant à
 * classer les profils candidats. Fonction pure (testable sans base de données).
 */
final class Recommender
{
    // Poids de chaque facteur (ajustables sans toucher à la logique).
    private const W_SHARED_INTEREST = 10.0; // par intérêt commun
    private const W_MAX_INTERESTS    = 40.0; // plafond intérêts
    private const W_SAME_CITY         = 18.0;
    private const W_SAME_COUNTRY      = 8.0;
    private const W_ONLINE            = 12.0;
    private const W_RECENT_ACTIVE     = 6.0;  // actif < 24 h
    private const W_VERIFIED          = 8.0;
    private const W_AGE_BASE          = 12.0; // décroît avec l'écart d'âge

    /**
     * Calcule le score d'affinité entre un observateur et un candidat.
     *
     * @param array $viewer    ['interests'=>array, 'city'=>?string, 'country'=>?string, 'age'=>?int]
     * @param array $candidate ['interests'=>array, 'city'=>?, 'country'=>?, 'age'=>?,
     *                          'is_online'=>bool, 'is_verified'=>bool, 'last_active_at'=>?string,
     *                          'distance_km'=>?float]
     */
    public static function score(array $viewer, array $candidate): float
    {
        $score = 0.0;

        // 1) Intérêts partagés (insensible à la casse).
        $vi = array_map('mb_strtolower', array_map('strval', $viewer['interests'] ?? []));
        $ci = array_map('mb_strtolower', array_map('strval', $candidate['interests'] ?? []));
        $shared = count(array_intersect($vi, $ci));
        $score += min(self::W_MAX_INTERESTS, $shared * self::W_SHARED_INTEREST);

        // 2) Proximité géographique : distance si connue, sinon ville/pays.
        $distance = $candidate['distance_km'] ?? null;
        if (is_numeric($distance)) {
            // 20 pts à 0 km, dégressif, nul au-delà de ~200 km.
            $score += max(0.0, 20.0 - ((float) $distance / 10.0));
        } else {
            if (!empty($viewer['city']) && self::eq($viewer['city'], $candidate['city'] ?? null)) {
                $score += self::W_SAME_CITY;
            } elseif (!empty($viewer['country']) && self::eq($viewer['country'], $candidate['country'] ?? null)) {
                $score += self::W_SAME_COUNTRY;
            }
        }

        // 3) Proximité d'âge (écart faible = bonus).
        if (!empty($viewer['age']) && !empty($candidate['age'])) {
            $diff = abs((int) $viewer['age'] - (int) $candidate['age']);
            $score += max(0.0, self::W_AGE_BASE - $diff);
        }

        // 4) Signaux d'engagement / confiance.
        if (!empty($candidate['is_online'])) {
            $score += self::W_ONLINE;
        } elseif (!empty($candidate['last_active_at']) && (time() - strtotime((string) $candidate['last_active_at'])) < 86400) {
            $score += self::W_RECENT_ACTIVE;
        }
        if (!empty($candidate['is_verified'])) {
            $score += self::W_VERIFIED;
        }

        return round($score, 2);
    }

    /**
     * Classe les candidats par affinité décroissante ; ajoute la clé « affinity ».
     */
    public static function rank(array $viewer, array $candidates): array
    {
        foreach ($candidates as &$c) {
            $c['affinity'] = self::score($viewer, $c);
        }
        unset($c);
        usort($candidates, fn($a, $b) => $b['affinity'] <=> $a['affinity']);
        return $candidates;
    }

    private static function eq(?string $a, ?string $b): bool
    {
        return $a !== null && $b !== null && mb_strtolower(trim($a)) === mb_strtolower(trim($b));
    }
}

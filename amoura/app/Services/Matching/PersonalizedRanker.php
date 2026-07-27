<?php
declare(strict_types=1);

namespace Amoura\Services\Matching;

use Amoura\Models\Swipe;

/**
 * Classement personnalisé par apprentissage implicite (Phase 6, Sprint +15).
 *
 * Reclasse un vivier de candidats (déjà notés par affinité) en mêlant le score
 * d'affinité de base au goût APPRIS du membre (cf. TasteProfile) à partir de son
 * historique de swipes. Sans signal suffisant, l'ordre d'affinité est conservé.
 */
final class PersonalizedRanker
{
    /** Amplitude de l'ajustement personnalisé ajouté au score d'affinité. */
    private const SCALE = 40.0;

    /**
     * Reclasse les candidats pour un membre donné (charge son historique).
     * @param array<int,array> $candidates profils enrichis (avec 'affinity')
     * @return array<int,array> mêmes profils, réordonnés + 'taste'/'personalized'
     */
    public static function rerank(int $userId, array $candidates, ?Swipe $swipe = null): array
    {
        $decisions = ($swipe ?? new Swipe())->decisionsFor($userId);
        [$liked, $passed] = self::split($decisions);
        $taste = TasteProfile::learn($liked, $passed);

        return self::apply($taste, $candidates);
    }

    /**
     * Applique un goût déjà appris à des candidats (séparé pour la testabilité).
     * @param array<int,array> $candidates
     * @return array<int,array>
     */
    public static function apply(array $taste, array $candidates): array
    {
        if (empty($taste['has_signal'])) {
            return $candidates; // pas assez de données → on garde l'ordre d'affinité
        }

        foreach ($candidates as &$c) {
            $t = TasteProfile::score($c, $taste);
            $c['taste'] = round($t, 3);
            // Ajustement centré : un goût > 0.5 remonte le profil, < 0.5 le descend.
            $c['personalized'] = (float) ($c['affinity'] ?? 0.0) + ($t - 0.5) * self::SCALE;
        }
        unset($c);

        usort($candidates, fn($a, $b) => $b['personalized'] <=> $a['personalized']);
        return $candidates;
    }

    /**
     * Sépare les décisions en profils aimés / passés avec features normalisées.
     * @param array<int,array> $decisions
     * @return array{0:array<int,array>,1:array<int,array>}
     */
    private static function split(array $decisions): array
    {
        $liked = $passed = [];
        foreach ($decisions as $d) {
            $feature = [
                'age' => self::ageFrom($d['birthdate'] ?? null),
                'is_verified' => (int) ($d['is_verified'] ?? 0) === 1,
                'interests' => json_decode((string) ($d['interests'] ?? '[]'), true) ?: [],
            ];
            if (in_array($d['action'] ?? '', ['like', 'superlike'], true)) {
                $liked[] = $feature;
            } else {
                $passed[] = $feature;
            }
        }
        return [$liked, $passed];
    }

    private static function ageFrom(?string $birthdate): ?int
    {
        if (!$birthdate) {
            return null;
        }
        $ts = strtotime($birthdate);
        return $ts ? (int) floor((time() - $ts) / (365.25 * 86400)) : null;
    }
}

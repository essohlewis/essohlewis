<?php
declare(strict_types=1);

namespace Amoura\Services\Matching;

/**
 * Modèle de goût par apprentissage implicite (Phase 6, Sprint +15).
 *
 * Apprend les préférences RÉVÉLÉES d'un membre à partir de ses décisions passées
 * (like/pass) : âge préféré, appétence pour les profils vérifiés, centres
 * d'intérêt qui déclenchent un like. Puis note un candidat selon ces préférences.
 *
 * 100 % pur (aucune I/O) → testable et remplaçable par un vrai modèle ML/embeddings.
 * Chaque « feature » de profil : ['age'=>?int, 'is_verified'=>bool,
 * 'interests'=>string[] (minuscules)].
 */
final class TasteProfile
{
    /** Nombre minimal de décisions pour dégager un signal exploitable. */
    public const MIN_SIGNAL = 5;

    /**
     * Apprend un profil de goût.
     * @param array<int,array> $liked  profils aimés (like/superlike)
     * @param array<int,array> $passed profils passés
     * @return array{has_signal:bool, preferred_age:?float, age_tolerance:float,
     *               verified_pref:float, interest_weights:array<string,float>}
     */
    public static function learn(array $liked, array $passed): array
    {
        $total = count($liked) + count($passed);
        if ($total < self::MIN_SIGNAL) {
            return ['has_signal' => false, 'preferred_age' => null, 'age_tolerance' => 6.0,
                    'verified_pref' => 0.5, 'interest_weights' => []];
        }

        // Âge préféré = moyenne des âges aimés ; tolérance = écart-type (plancher 4).
        $ages = [];
        foreach ($liked as $p) {
            if (!empty($p['age'])) {
                $ages[] = (int) $p['age'];
            }
        }
        $preferredAge = $ages ? array_sum($ages) / count($ages) : null;
        $tolerance = 6.0;
        if (count($ages) >= 2 && $preferredAge !== null) {
            $var = 0.0;
            foreach ($ages as $a) {
                $var += ($a - $preferredAge) ** 2;
            }
            $tolerance = max(4.0, sqrt($var / count($ages)));
        }

        // Appétence « vérifié » : taux de like parmi les profils vérifiés rencontrés.
        $vLike = $vSeen = 0;
        foreach ([[$liked, true], [$passed, false]] as [$set, $isLike]) {
            foreach ($set as $p) {
                if (!empty($p['is_verified'])) {
                    $vSeen++;
                    if ($isLike) {
                        $vLike++;
                    }
                }
            }
        }
        $verifiedPref = $vSeen > 0 ? (float) $vLike / $vSeen : 0.5;

        // Poids d'intérêts : fréquence parmi les profils aimés.
        $weights = [];
        $likedCount = max(1, count($liked));
        foreach ($liked as $p) {
            foreach (self::interests($p) as $i) {
                $weights[$i] = ($weights[$i] ?? 0) + 1;
            }
        }
        foreach ($weights as $k => $v) {
            $weights[$k] = $v / $likedCount;   // 0..1
        }
        arsort($weights);
        $weights = array_slice($weights, 0, 12, true);

        return [
            'has_signal' => true,
            'preferred_age' => $preferredAge,
            'age_tolerance' => $tolerance,
            'verified_pref' => $verifiedPref,
            'interest_weights' => $weights,
        ];
    }

    /**
     * Note un candidat selon le goût appris. Renvoie 0.5 (neutre) sans signal.
     * @return float dans [0,1]
     */
    public static function score(array $candidate, array $taste): float
    {
        if (empty($taste['has_signal'])) {
            return 0.5;
        }

        $components = []; // [poids, valeur]

        // Intérêts (poids fort) : somme des poids appris des intérêts du candidat.
        if (!empty($taste['interest_weights'])) {
            $sum = 0.0;
            foreach (self::interests($candidate) as $i) {
                $sum += (float) ($taste['interest_weights'][$i] ?? 0);
            }
            $components[] = [0.45, min(1.0, $sum)];
        }

        // Âge : proximité à l'âge préféré, normalisée par la tolérance.
        if ($taste['preferred_age'] !== null && !empty($candidate['age'])) {
            $diff = abs((float) $candidate['age'] - (float) $taste['preferred_age']);
            $val = max(0.0, 1.0 - $diff / (2.0 * (float) $taste['age_tolerance']));
            $components[] = [0.35, $val];
        }

        // Vérifié : aligne le candidat sur l'appétence apprise.
        $vp = (float) $taste['verified_pref'];
        $components[] = [0.20, !empty($candidate['is_verified']) ? $vp : 1.0 - $vp];

        // Moyenne pondérée avec renormalisation sur les composantes disponibles.
        $wsum = 0.0;
        $acc = 0.0;
        foreach ($components as [$w, $v]) {
            $wsum += $w;
            $acc += $w * $v;
        }
        return $wsum > 0 ? $acc / $wsum : 0.5;
    }

    /** Normalise la liste d'intérêts (déjà en minuscules attendu, mais robuste). */
    private static function interests(array $profile): array
    {
        $raw = $profile['interests'] ?? [];
        if (!is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $i) {
            $i = mb_strtolower(trim((string) $i));
            if ($i !== '') {
                $out[] = $i;
            }
        }
        return array_values(array_unique($out));
    }
}

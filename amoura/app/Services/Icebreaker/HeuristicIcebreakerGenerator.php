<?php
declare(strict_types=1);

namespace Amoura\Services\Icebreaker;

/**
 * Générateur de brise-glaces heuristique (v1) — Phase 6, Sprint +14.
 *
 * Compose des accroches personnalisées à partir des points communs et du profil
 * du destinataire (intérêts partagés, centres d'intérêt, ville, métier, objectif
 * de relation), avec un repli sur des questions ouvertes universelles. Pensé pour
 * rester bienveillant et concret ; remplaçable par un LLM via IcebreakerGenerator.
 */
final class HeuristicIcebreakerGenerator implements IcebreakerGenerator
{
    /** Questions ouvertes de repli (aucune donnée de profil requise). */
    private const FALLBACKS = [
        'Si tu pouvais t\'envoler n\'importe où demain, ce serait où ? ✈️',
        'Plutôt grasse mat\' du week-end ou lever de soleil ? ☀️',
        'C\'est quoi la dernière chose qui t\'a fait éclater de rire ?',
        'Un plat que tu pourrais manger toute ta vie sans t\'en lasser ?',
        'Team plage ou team montagne ? 🏖️⛰️',
    ];

    public function suggest(array $me, array $them, int $limit = 3): array
    {
        $limit = max(1, min(6, $limit));
        $suggestions = [];

        $myInterests = self::interests($me);
        $theirInterests = self::interests($them);
        $shared = array_values(array_intersect($myInterests, $theirInterests));
        $name = self::firstName($them);

        // 1) Intérêts communs — l'accroche la plus efficace.
        foreach ($shared as $interest) {
            $suggestions[] = "On partage tous les deux un faible pour {$interest} 😍 c'est quoi ton meilleur souvenir lié à ça ?";
        }

        // 2) Un intérêt du destinataire (hors communs).
        foreach (array_diff($theirInterests, $shared) as $interest) {
            $suggestions[] = "J'ai vu que tu aimes {$interest} — raconte, comment tu as attrapé le virus ?";
        }

        // 3) Ville.
        if (($city = self::str($them, 'city')) !== '') {
            $suggestions[] = "Alors, {$city} 🌍 tu me conseilles quoi comme adresse à ne pas rater ?";
        }

        // 4) Métier.
        if (($job = self::str($them, 'job_title')) !== '') {
            $suggestions[] = "{$job}, ça pique ma curiosité ! Qu'est-ce qui te plaît le plus là-dedans ?";
        }

        // 5) Objectif de relation.
        $goal = self::str($them, 'relationship_goal');
        $goals = [
            'serious' => 'Qu\'est-ce qui te fait dire « c\'est la bonne personne » ?',
            'friends' => 'Tu cherches surtout à rencontrer du monde sympa par ici ?',
            'casual'  => 'Plutôt sorties spontanées ou plans tranquilles à deux ?',
        ];
        if (isset($goals[$goal])) {
            $suggestions[] = $goals[$goal];
        }

        // 6) Repli sur des questions ouvertes.
        foreach (self::FALLBACKS as $f) {
            $suggestions[] = $f;
        }

        // Dédoublonnage + personnalisation du prénom en tête si connu.
        // (La liste n'est jamais vide : les questions de repli sont toujours ajoutées.)
        $suggestions = array_values(array_unique($suggestions));
        if ($name !== '') {
            $suggestions[0] = $name . ', ' . lcfirst($suggestions[0]);
        }
        return array_slice($suggestions, 0, $limit);
    }

    /** Extrait la liste d'intérêts (stockée en JSON) d'un profil, normalisée. */
    private static function interests(array $profile): array
    {
        $raw = $profile['interests'] ?? [];
        if (is_string($raw)) {
            $raw = json_decode($raw, true) ?: [];
        }
        if (!is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $i) {
            $i = trim((string) $i);
            if ($i !== '') {
                $out[] = mb_strtolower($i);
            }
        }
        return array_values(array_unique($out));
    }

    private static function str(array $profile, string $key): string
    {
        return trim((string) ($profile[$key] ?? ''));
    }

    private static function firstName(array $profile): string
    {
        $name = self::str($profile, 'display_name');
        return $name !== '' ? explode(' ', $name)[0] : '';
    }
}

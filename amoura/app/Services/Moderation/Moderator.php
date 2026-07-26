<?php
declare(strict_types=1);

namespace Amoura\Services\Moderation;

/**
 * Contrat d'un moteur de modération de contenu (Sprint +3).
 * L'implémentation v1 est heuristique (règles) ; elle pourra être remplacée
 * par un backend ML/API (ex. classification de toxicité) sans changer les appels.
 */
interface Moderator
{
    /**
     * Analyse un texte et renvoie un verdict.
     * @return array{score:int, flags:array<string>, action:string}
     *   score  : 0 (sain) → 100 (très risqué)
     *   flags  : étiquettes déclenchées (ex. "contact_info", "scam")
     *   action : "allow" | "review" | "block"
     */
    public function analyze(string $text): array;
}

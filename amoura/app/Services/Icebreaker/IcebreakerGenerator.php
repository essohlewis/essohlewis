<?php
declare(strict_types=1);

namespace Amoura\Services\Icebreaker;

/**
 * Contrat d'un générateur de brise-glaces (Phase 6, Sprint +14).
 * Interface simple pour brancher un modèle de langage (LLM) réel en remplacement
 * de l'heuristique v1, sans toucher au reste du flux.
 */
interface IcebreakerGenerator
{
    /**
     * Propose des phrases d'accroche personnalisées pour engager la conversation.
     * @param array $me    profil de l'expéditeur (interests, bio, city…)
     * @param array $them  profil du destinataire
     * @param int   $limit nombre de suggestions
     * @return array<int,string>
     */
    public function suggest(array $me, array $them, int $limit = 3): array;
}

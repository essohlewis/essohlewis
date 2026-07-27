<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\Matching;
use Amoura\Models\User;
use Amoura\Services\Icebreaker\HeuristicIcebreakerGenerator;

/**
 * Suggestions de brise-glaces (Phase 6, Sprint +14).
 * Renvoie des accroches personnalisées pour engager la conversation avec un match.
 */
final class IcebreakerController extends Controller
{
    public function suggest(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $targetId = (int) ($params['id'] ?? 0);
        $me = (int) $user['id'];

        // Réservé aux profils déjà « matchés » (contexte d'une conversation).
        if ($targetId <= 0 || !(new Matching())->areMatched($me, $targetId)) {
            $this->json(['ok' => false, 'error' => 'Non autorisé.'], 403);
        }

        $userModel = new User();
        $them = $userModel->fullProfile($targetId);
        if (!$them) {
            $this->json(['ok' => false, 'error' => 'Profil introuvable.'], 404);
        }

        $suggestions = (new HeuristicIcebreakerGenerator())->suggest(
            $userModel->fullProfile($me) ?? [],
            $them,
            3
        );
        $this->json(['ok' => true, 'suggestions' => $suggestions]);
    }
}

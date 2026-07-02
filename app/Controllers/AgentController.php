<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Validator;
use Transouscris\Models\Agent;

/**
 * Réseau d'agents : annuaire public des agents disponibles, gestion de la
 * disponibilité et notation.
 */
final class AgentController extends Controller
{
    public function index(Request $request): Response
    {
        $zone   = $request->query('zone');
        $agents = Agent::available(is_string($zone) && $zone !== '' ? $zone : null);
        return $this->view('agent.index', ['title' => 'Agents disponibles', 'agents' => $agents]);
    }

    /** Bascule de disponibilité par l'agent connecté (garde de rôle + IDOR). */
    public function toggleAvailability(Request $request): Response
    {
        $user  = $this->requireUser();
        $agent = Agent::firstWhere('user_id', $user->id);
        if ($agent === null || !$user->isAgent()) {
            return $this->json(['error' => 'Compte agent requis.'], 403);
        }
        $agent->setAvailability(!$agent->isAvailable);
        return $this->json(['ok' => true, 'available' => $agent->isAvailable]);
    }

    /** Notation d'un agent (1–5) par un utilisateur. */
    public function rate(Request $request, string $id): Response
    {
        $this->requireUser();
        $data  = Validator::make($request->only(['stars']))->validate(['stars' => 'required|int|between:1,5']);
        $agent = Agent::find((int) $id);
        if ($agent === null) {
            return $this->json(['error' => 'Agent introuvable.'], 404);
        }
        $agent->addRating((int) $data['stars']);
        return $this->json(['ok' => true, 'rating_avg' => $agent->ratingAvg, 'rating_count' => $agent->ratingCount]);
    }
}

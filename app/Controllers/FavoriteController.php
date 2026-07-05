<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Exceptions\HttpException;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Core\Validator;
use Transouscris\Models\Favorite;
use Transouscris\Services\OperatorDetector;

/**
 * Gestion des favoris (numéros enregistrés). Toutes les actions vérifient
 * l'appartenance à l'utilisateur (anti-IDOR).
 */
final class FavoriteController extends Controller
{
    public function __construct(private OperatorDetector $detector = new OperatorDetector()) {}

    public function index(Request $request): Response
    {
        $user = $this->requireUser();
        return $this->view('favorite.index', [
            'title'     => 'Mes favoris',
            'favorites' => Favorite::forUser($user->id),
        ]);
    }

    public function store(Request $request): Response
    {
        $user = $this->requireUser();
        $data = Validator::make($request->only(['label', 'relation', 'phone']))->validate([
            'label'    => 'required|string|max:80',
            'relation' => 'required|in:moi,famille,parents,conjoint,enfants,amis,entreprise,autre',
            'phone'    => 'required|phone_ci',
        ]);

        $detected = $this->detector->detect($data['phone']);
        if ($detected['msisdn'] === null) {
            return $this->json(['error' => 'Numéro invalide.'], 422);
        }

        Favorite::upsert(
            $user->id,
            $data['label'],
            $data['relation'],
            $detected['msisdn'],
            $detected['operator']
        );
        return $this->json(['ok' => true, 'redirect' => '/favoris']);
    }

    public function destroy(Request $request, string $id): Response
    {
        $user     = $this->requireUser();
        $favorite = Favorite::find((int) $id);
        if ($favorite === null) {
            throw new HttpException(404);
        }
        $this->authorizeOwnership($favorite->userId, $user);
        $favorite->delete();
        return $this->json(['ok' => true]);
    }
}

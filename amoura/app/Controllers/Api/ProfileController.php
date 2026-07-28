<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Models\Photo;
use Amoura\Models\User;
use Amoura\Services\Profile\ProfileService;

/**
 * Profil pour les clients mobiles (jeton porteur) : consultation de son propre
 * profil, mise à jour, et consultation d'un autre profil (avec enregistrement de
 * la visite dans le respect du mode incognito). Réutilise ProfileService.
 * L'envoi de photos reste sur l'endpoint web multipart.
 */
final class ProfileController extends ApiController
{
    /** Profil de l'utilisateur courant (avec ses photos). */
    public function me(Request $request): void
    {
        $this->requireAbility('profile:read');
        $uid = (int) $this->user()['id'];
        $svc = new ProfileService();
        $full = (new User())->fullProfile($uid) ?? [];
        Response::ok([
            'profile' => $svc->publicProfile($full, true),
            'photos'  => $svc->photos((new Photo())->forUser($uid)),
        ]);
    }

    /** Mise à jour du profil courant. */
    public function update(Request $request): void
    {
        $this->requireAbility('profile:write');
        $uid = (int) $this->user()['id'];
        (new ProfileService())->update($uid, $request->all());
        $full = (new User())->fullProfile($uid) ?? [];
        Response::ok(['profile' => (new ProfileService())->publicProfile($full, true)]);
    }

    /** Consultation d'un autre profil (enregistre la visite hors incognito). */
    public function show(Request $request, array $params): void
    {
        $this->requireAbility('profile:read');
        $targetId = (int) $params['id'];
        $full = (new User())->fullProfile($targetId);
        if (!$full || ($full['status'] ?? null) !== 'active') {
            Response::error('Profil introuvable', 404);
        }
        $svc = new ProfileService();
        $svc->recordViewIfAllowed((int) $this->user()['id'], $targetId);
        Response::ok([
            'profile' => $svc->publicProfile($full, (int) $this->user()['id'] === $targetId),
            'photos'  => $svc->photos((new Photo())->forUser($targetId)),
        ]);
    }
}

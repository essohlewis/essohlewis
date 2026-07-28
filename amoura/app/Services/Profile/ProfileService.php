<?php
declare(strict_types=1);

namespace Amoura\Services\Profile;

use Amoura\Core\Security\Sanitizer;
use Amoura\Models\Profile;
use Amoura\Models\ProfileView;
use Amoura\Models\Subscription;

/**
 * Logique métier du profil, partagée entre l'application web (ProfileController)
 * et l'API mobile (Api\ProfileController) : validation/normalisation des champs
 * à l'enregistrement, projection publique stable et enregistrement des visites
 * (« qui a vu mon profil ») dans le respect du mode incognito.
 */
final class ProfileService
{
    /**
     * Valide et enregistre les champs de profil éditables (upsert).
     *
     * @param array<string,mixed> $data entrées brutes (formulaire web ou JSON mobile).
     */
    public function update(int $uid, array $data): void
    {
        $interests = array_filter(array_map('trim', explode(',', (string) ($data['interests'] ?? ''))));
        $languages = array_filter(array_map('trim', explode(',', (string) ($data['languages'] ?? ''))));

        (new Profile())->upsert($uid, [
            'bio'         => Sanitizer::text($data['bio'] ?? '', 1000),
            'orientation' => in_array($data['orientation'] ?? '', ['straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'other'], true) ? $data['orientation'] : null,
            'looking_for' => in_array($data['looking_for'] ?? '', ['male', 'female', 'everyone'], true) ? $data['looking_for'] : 'everyone',
            'country'     => Sanitizer::text($data['country'] ?? '', 2),
            'city'        => Sanitizer::text($data['city'] ?? '', 120),
            'job_title'   => Sanitizer::text($data['job_title'] ?? '', 120),
            'education'   => Sanitizer::text($data['education'] ?? '', 120),
            'interests'   => json_encode(array_slice(array_values($interests), 0, 15)),
            'languages'   => json_encode(array_slice(array_values($languages), 0, 10)),
            'smoking'     => in_array($data['smoking'] ?? '', ['no', 'sometimes', 'yes'], true) ? $data['smoking'] : null,
            'drinking'    => in_array($data['drinking'] ?? '', ['no', 'sometimes', 'yes'], true) ? $data['drinking'] : null,
            'children'    => in_array($data['children'] ?? '', ['no', 'someday', 'have', 'have_more'], true) ? $data['children'] : null,
            'religion'    => Sanitizer::text($data['religion'] ?? '', 40),
            'relationship_goal' => in_array($data['relationship_goal'] ?? '', ['casual', 'serious', 'friends', 'unsure'], true) ? $data['relationship_goal'] : null,
            'latitude'    => is_numeric($data['latitude'] ?? null) ? (float) $data['latitude'] : null,
            'longitude'   => is_numeric($data['longitude'] ?? null) ? (float) $data['longitude'] : null,
        ]);
    }

    /**
     * Projection publique et stable d'un profil (issu de User::fullProfile).
     * Les champs de localisation précise (lat/long) et de complétion ne sont
     * exposés qu'au propriétaire.
     *
     * @param array<string,mixed> $p
     * @return array<string,mixed>
     */
    public function publicProfile(array $p, bool $own): array
    {
        $out = [
            'id'           => (int) $p['id'],
            'display_name' => $p['display_name'] ?? null,
            'age'          => age_from($p['birthdate'] ?? null),
            'gender'       => $p['gender'] ?? null,
            'is_verified'  => (bool) ($p['is_verified'] ?? false),
            'is_online'    => (bool) ($p['is_online'] ?? false),
            'bio'          => $p['bio'] ?? null,
            'orientation'  => $p['orientation'] ?? null,
            'looking_for'  => $p['looking_for'] ?? null,
            'country'      => $p['country'] ?? null,
            'city'         => $p['city'] ?? null,
            'job_title'    => $p['job_title'] ?? null,
            'education'    => $p['education'] ?? null,
            'interests'    => json_decode((string) ($p['interests'] ?? '[]'), true) ?: [],
            'languages'    => json_decode((string) ($p['languages'] ?? '[]'), true) ?: [],
            'avatar'       => avatar_url($p['avatar_path'] ?? null),
        ];
        if ($own) {
            $out['completion'] = (int) ($p['completion'] ?? 0);
            $out['latitude']   = isset($p['latitude']) ? (float) $p['latitude'] : null;
            $out['longitude']  = isset($p['longitude']) ? (float) $p['longitude'] : null;
        }
        return $out;
    }

    /**
     * Projection des photos d'un profil.
     *
     * @param array<int,array<string,mixed>> $photos
     * @return array<int,array<string,mixed>>
     */
    public function photos(array $photos): array
    {
        return array_map(static fn(array $ph): array => [
            'id'         => (int) $ph['id'],
            'path'       => '/uploads/' . $ph['path'],
            'thumb'      => !empty($ph['thumb_path']) ? '/uploads/' . $ph['thumb_path'] : null,
            'is_primary' => (bool) $ph['is_primary'],
            'moderation' => $ph['moderation'] ?? null,
        ], $photos);
    }

    /**
     * Enregistre une visite de profil, sauf auto-visite ou navigation incognito
     * (VIP entitlé). Miroir exact de la logique web.
     */
    public function recordViewIfAllowed(int $viewerId, int $targetId): void
    {
        if ($viewerId === $targetId) {
            return;
        }
        $incognito = (new Profile())->isIncognito($viewerId)
            && (new Subscription())->hasFeature($viewerId, 'incognito');
        if (!$incognito) {
            (new ProfileView())->record($targetId, $viewerId);
        }
    }
}

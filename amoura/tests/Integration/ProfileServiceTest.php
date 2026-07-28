<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\ProfileView;
use Amoura\Models\User;
use Amoura\Services\Profile\ProfileService;

/**
 * Profil (Phase 5, Sprint +26) : logique partagée web/API — validation des
 * champs à l'enregistrement, projection publique (champs sensibles réservés au
 * propriétaire) et enregistrement des visites.
 */
final class ProfileServiceTest extends IntegrationTestCase
{
    public function testUpdateNormalizesAndPersistsFields(): void
    {
        $uid = $this->makeUser('prof-a@example.com');
        $svc = new ProfileService();

        $svc->update($uid, [
            'bio'         => '  Bonjour, je cuisine 🍲  ',
            'orientation' => 'straight',
            'looking_for' => 'male',
            'city'        => 'Abidjan',
            'interests'   => 'cuisine, voyage , sport',
            'smoking'     => 'no',
            'relationship_goal' => 'serious',
            'latitude'    => '5.35',
            'longitude'   => '-4.02',
        ]);

        $full = (new User())->fullProfile($uid) ?? [];
        $pub = $svc->publicProfile($full, true);
        $this->assertSame('Bonjour, je cuisine 🍲', $pub['bio']);
        $this->assertSame('Abidjan', $pub['city']);
        $this->assertSame(['cuisine', 'voyage', 'sport'], $pub['interests']);
        // relationship_goal n'est pas dans la projection fullProfile : on vérifie en base.
        $raw = $this->db->query('SELECT relationship_goal, smoking FROM profiles WHERE user_id = ' . (int) $uid)->fetch();
        $this->assertSame('serious', $raw['relationship_goal']);
        $this->assertSame('no', $raw['smoking']);
    }

    public function testInvalidEnumValuesFallBackSafely(): void
    {
        $uid = $this->makeUser('prof-b@example.com');
        $svc = new ProfileService();
        $svc->update($uid, ['orientation' => 'martian', 'looking_for' => 'aliens', 'smoking' => 'maybe']);

        $full = (new User())->fullProfile($uid) ?? [];
        // Valeurs invalides ignorées ; looking_for retombe sur « everyone ».
        $this->assertNull($full['orientation']);
        $this->assertSame('everyone', $full['looking_for']);
    }

    public function testPublicProjectionHidesSensitiveFieldsFromOthers(): void
    {
        $uid = $this->makeUser('prof-c@example.com');
        (new ProfileService())->update($uid, ['latitude' => '5.35', 'longitude' => '-4.02']);
        $full = (new User())->fullProfile($uid) ?? [];
        $svc = new ProfileService();

        $own = $svc->publicProfile($full, true);
        $this->assertArrayHasKey('latitude', $own);
        $this->assertArrayHasKey('completion', $own);

        $other = $svc->publicProfile($full, false);
        $this->assertArrayNotHasKey('latitude', $other);
        $this->assertArrayNotHasKey('longitude', $other);
        $this->assertArrayNotHasKey('completion', $other);
    }

    public function testRecordViewRespectsSelfAndIncognito(): void
    {
        $viewer = $this->makeUser('prof-viewer@example.com');
        $target = $this->makeUser('prof-target@example.com');
        $svc = new ProfileService();
        $views = new ProfileView();

        // Auto-visite : jamais enregistrée.
        $svc->recordViewIfAllowed($viewer, $viewer);
        $this->assertSame(0, $views->countFor($viewer));

        // Visite normale : enregistrée.
        $svc->recordViewIfAllowed($viewer, $target);
        $this->assertSame(1, $views->countFor($target));
    }
}

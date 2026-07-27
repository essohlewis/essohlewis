<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Plan;
use Amoura\Models\Profile;
use Amoura\Models\ProfileView;
use Amoura\Models\Subscription;

/**
 * Mode incognito / navigation privée VIP (Phase 3, Sprint +11).
 * Le droit dépend de DEUX conditions : le flag activé ET un abonnement VIP en
 * cours (la fonctionnalité « incognito » figure dans l'offre VIP).
 */
final class IncognitoTest extends IntegrationTestCase
{
    /** Reproduit la garde du contrôleur : flag ET droit VIP. */
    private function browsingIncognito(int $userId): bool
    {
        return (new Profile())->isIncognito($userId)
            && (new Subscription())->hasFeature($userId, 'incognito');
    }

    public function testIncognitoRequiresVipEntitlement(): void
    {
        $u = $this->makeUser('incog@test.io');
        (new Profile())->updatePrivacy($u, ['incognito' => 1]);

        // Flag posé mais pas d'abonnement VIP → pas d'incognito effectif.
        $this->assertTrue((new Profile())->isIncognito($u));
        $this->assertFalse((new Subscription())->hasFeature($u, 'incognito'));
        $this->assertFalse($this->browsingIncognito($u));
    }

    public function testPremiumDoesNotGrantIncognito(): void
    {
        $u = $this->makeUser('prem@test.io');
        $prem = (new Plan())->bySlug('premium');
        (new Subscription())->activate($u, (int) $prem['id'], 'stripe', 'P1', 'month');
        (new Profile())->updatePrivacy($u, ['incognito' => 1]);

        $this->assertFalse((new Subscription())->hasFeature($u, 'incognito'), 'Premium n\'inclut pas incognito');
        $this->assertFalse($this->browsingIncognito($u));
    }

    public function testVipIncognitoLeavesNoProfileViewTrace(): void
    {
        $vipUser = $this->makeUser('vip@test.io');
        $target = $this->makeUser('target@test.io', 'male');
        $vip = (new Plan())->bySlug('vip');
        (new Subscription())->activate($vipUser, (int) $vip['id'], 'stripe', 'V1', 'month');
        (new Profile())->updatePrivacy($vipUser, ['incognito' => 1]);

        $this->assertTrue($this->browsingIncognito($vipUser));

        // Reproduit la logique de ProfileController::show : pas d'enregistrement.
        if (!$this->browsingIncognito($vipUser)) {
            (new ProfileView())->record($target, $vipUser);
        }
        $count = (int) $this->db->query(
            "SELECT COUNT(*) FROM profile_views WHERE profile_id = {$target} AND viewer_id = {$vipUser}"
        )->fetchColumn();
        $this->assertSame(0, $count, 'aucune trace de visite en incognito');
    }

    public function testNonIncognitoLeavesTrace(): void
    {
        $viewer = $this->makeUser('viewer@test.io');
        $target = $this->makeUser('seen@test.io', 'male');

        $this->assertFalse($this->browsingIncognito($viewer));
        if (!$this->browsingIncognito($viewer)) {
            (new ProfileView())->record($target, $viewer);
        }
        $count = (int) $this->db->query(
            "SELECT COUNT(*) FROM profile_views WHERE profile_id = {$target} AND viewer_id = {$viewer}"
        )->fetchColumn();
        $this->assertSame(1, $count);
    }
}

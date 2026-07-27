<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\User;
use Amoura\Models\Verification;

/**
 * Flux de vérification de profil par selfie (Phase 4, Sprint +10) :
 * soumission, file de revue priorisée, décision (badge) et idempotence.
 */
final class VerificationTest extends IntegrationTestCase
{
    public function testSubmitCreatesPendingRequest(): void
    {
        $uid = $this->makeUser('verif@test.io');
        $v = new Verification();
        $id = $v->submit($uid, 'verifications/selfie.jpg', 62);

        $this->assertGreaterThan(0, $id);
        $this->assertTrue($v->hasPending($uid));
        $latest = $v->latestFor($uid);
        $this->assertSame('pending', $latest['status']);
        $this->assertSame(62, (int) $latest['auto_score']);
    }

    public function testApprovalSetsVerifiedBadgeAndIsIdempotent(): void
    {
        $uid = $this->makeUser('approve@test.io');
        $staff = $this->makeUser('staff@test.io', 'male');
        $v = new Verification();
        $id = $v->submit($uid, 'verifications/s.jpg', 70);

        $affectedUser = $v->decide($id, $staff, true);
        $this->assertSame($uid, $affectedUser);

        $fresh = (new User())->find($uid);
        $this->assertSame(1, (int) $fresh['is_verified'], 'le badge vérifié est posé');
        $this->assertSame('approved', $v->latestFor($uid)['status']);
        $this->assertFalse($v->hasPending($uid));

        // Rejouer la décision ne fait rien (déjà traitée).
        $this->assertNull($v->decide($id, $staff, true));
    }

    public function testRejectionDoesNotVerify(): void
    {
        $uid = $this->makeUser('reject@test.io');
        $staff = $this->makeUser('mod@test.io', 'male');
        $v = new Verification();
        $id = $v->submit($uid, 'verifications/s.jpg', 20);

        $this->assertSame($uid, $v->decide($id, $staff, false));
        $this->assertSame(0, (int) (new User())->find($uid)['is_verified']);
        $this->assertSame('rejected', $v->latestFor($uid)['status']);
    }

    public function testQueueOrdersByAutoScoreDesc(): void
    {
        $low = $this->makeUser('low@test.io');
        $high = $this->makeUser('high@test.io', 'male');
        $v = new Verification();
        $v->submit($low, 'verifications/a.jpg', 35);
        $v->submit($high, 'verifications/b.jpg', 85);

        $queue = $v->queue();
        $this->assertCount(2, $queue);
        $this->assertSame($high, (int) $queue[0]['user_id'], 'le meilleur score auto remonte');
    }
}

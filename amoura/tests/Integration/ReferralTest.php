<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Credit;
use Amoura\Models\Referral;

/** Programme de parrainage (Phase 5, Sprint +12). */
final class ReferralTest extends IntegrationTestCase
{
    public function testCodeIsStableAndUnique(): void
    {
        $a = $this->makeUser('a@test.io');
        $b = $this->makeUser('b@test.io', 'male');
        $ref = new Referral();

        $codeA = $ref->codeFor($a);
        $this->assertNotSame('', $codeA);
        $this->assertSame($codeA, $ref->codeFor($a), 'code stable pour un même utilisateur');
        $this->assertNotSame($codeA, $ref->codeFor($b), 'codes distincts entre utilisateurs');
    }

    public function testRecordRejectsSelfUnknownAndDuplicate(): void
    {
        $referrer = $this->makeUser('parrain@test.io');
        $referred = $this->makeUser('filleul@test.io', 'male');
        $ref = new Referral();
        $code = $ref->codeFor($referrer);

        $this->assertFalse($ref->record('CODEINCONNU', $referred), 'code inconnu → refusé');
        $this->assertFalse($ref->record($ref->codeFor($referred), $referred), 'auto-parrainage → refusé');

        $this->assertTrue($ref->record($code, $referred), 'parrainage valide');
        $this->assertFalse($ref->record($code, $referred), 'un filleul n\'est parrainé qu\'une fois');
    }

    public function testQualifyGrantsCreditsOnceToBothParties(): void
    {
        $referrer = $this->makeUser('p2@test.io');
        $referred = $this->makeUser('f2@test.io', 'male');
        $ref = new Referral();
        $ref->record($ref->codeFor($referrer), $referred);

        $rewarded = $ref->qualify($referred);
        $this->assertSame($referrer, $rewarded);

        $credit = new Credit();
        $this->assertSame(Referral::REFERRER_REWARD, $credit->balance($referrer, Referral::REWARD_ITEM));
        $this->assertSame(Referral::REFEREE_BONUS, $credit->balance($referred, Referral::REWARD_ITEM));

        // Idempotent : rejouer ne recrédite pas.
        $this->assertNull($ref->qualify($referred));
        $this->assertSame(Referral::REFERRER_REWARD, $credit->balance($referrer, Referral::REWARD_ITEM));
    }

    public function testQualifyWithoutReferralIsNoop(): void
    {
        $solo = $this->makeUser('solo@test.io');
        $this->assertNull((new Referral())->qualify($solo));
    }

    public function testStats(): void
    {
        $referrer = $this->makeUser('p3@test.io');
        $f1 = $this->makeUser('f3a@test.io', 'male');
        $f2 = $this->makeUser('f3b@test.io', 'male');
        $ref = new Referral();
        $code = $ref->codeFor($referrer);
        $ref->record($code, $f1);
        $ref->record($code, $f2);
        $ref->qualify($f1); // seul f1 qualifie

        $stats = $ref->statsFor($referrer);
        $this->assertSame(2, $stats['invited']);
        $this->assertSame(1, $stats['rewarded']);
        $this->assertSame(Referral::REFERRER_REWARD, $stats['credits_earned']);
    }
}

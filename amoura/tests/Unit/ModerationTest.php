<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Moderation\ContentModerator;
use PHPUnit\Framework\TestCase;

final class ModerationTest extends TestCase
{
    private ContentModerator $mod;

    protected function setUp(): void
    {
        $this->mod = new ContentModerator();
    }

    public function testCleanContentIsAllowed(): void
    {
        $v = $this->mod->analyze("Bonjour ! J'adore la randonnée, la cuisine italienne et les voyages.");
        $this->assertSame('allow', $v['action']);
        $this->assertSame([], $v['flags']);
        $this->assertLessThan(40, $v['score']);
    }

    public function testPhoneNumberTriggersReview(): void
    {
        $v = $this->mod->analyze("Appelle-moi au 07 07 08 09 10 stp");
        $this->assertContains('contact_phone', $v['flags']);
        $this->assertSame('review', $v['action']);
    }

    public function testEmailIsFlagged(): void
    {
        $v = $this->mod->analyze("écris à john.doe@example.com");
        $this->assertContains('contact_email', $v['flags']);
    }

    public function testSocialHandleFlagged(): void
    {
        $v = $this->mod->analyze("suis-moi sur instagram @monpseudo");
        $this->assertContains('contact_social', $v['flags']);
    }

    public function testScamContentIsBlocked(): void
    {
        $v = $this->mod->analyze("Investissez en bitcoin et crypto, paiement par western union et carte cadeau.");
        $this->assertContains('scam', $v['flags']);
        $this->assertGreaterThanOrEqual(75, $v['score']);
        $this->assertSame('block', $v['action']);
    }

    public function testHarassmentIsFlagged(): void
    {
        $v = $this->mod->analyze("tu n'es qu'une salope");
        $this->assertContains('harassment', $v['flags']);
        $this->assertGreaterThanOrEqual(40, $v['score']);
    }

    public function testSolicitationFlagged(): void
    {
        $v = $this->mod->analyze("je vends des nudes, contacte mon onlyfans");
        $this->assertContains('solicitation', $v['flags']);
    }

    public function testScoreIsCappedAt100(): void
    {
        $v = $this->mod->analyze("bitcoin crypto western union carte cadeau nudes escort 0707080910 x@y.com https://bad.link");
        $this->assertLessThanOrEqual(100, $v['score']);
        $this->assertSame('block', $v['action']);
    }
}

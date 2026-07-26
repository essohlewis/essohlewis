<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Moderation\RiskScorer;
use PHPUnit\Framework\TestCase;

/** Score de risque anti-fraude — logique pure (Sprint +6). */
final class RiskScorerTest extends TestCase
{
    public function testTrustedAccountIsLow(): void
    {
        $r = RiskScorer::score([
            'account_age_hours' => 5000,
            'has_photo' => true,
            'is_verified' => true,
            'reports_count' => 0,
            'bio' => 'Amateur de randonnée et de cinéma.',
            'swipes_last_hour' => 10,
        ]);
        $this->assertSame('low', $r['level']);
        $this->assertSame(0, $r['score']);
        $this->assertEmpty($r['flags']);
    }

    public function testNewAccountWithoutPhotoIsFlagged(): void
    {
        $r = RiskScorer::score([
            'account_age_hours' => 2,
            'has_photo' => false,
            'is_verified' => false,
            'reports_count' => 0,
        ]);
        $this->assertContains('new_account', $r['flags']);
        $this->assertContains('no_photo', $r['flags']);
        $this->assertSame(35, $r['score']); // 15 + 20
        $this->assertSame('medium', $r['level']);
    }

    public function testMultipleReportsRaiseHigh(): void
    {
        $r = RiskScorer::score([
            'account_age_hours' => 1,
            'has_photo' => false,
            'reports_count' => 3,
            'swipes_last_hour' => 200,
        ]);
        $this->assertContains('reported', $r['flags']);
        $this->assertContains('high_velocity', $r['flags']);
        $this->assertSame('high', $r['level']);
        $this->assertGreaterThanOrEqual(60, $r['score']);
    }

    public function testVerificationDiscountsScore(): void
    {
        $base = RiskScorer::score(['account_age_hours' => 2, 'has_photo' => false]);
        $verified = RiskScorer::score(['account_age_hours' => 2, 'has_photo' => false, 'is_verified' => true]);
        $this->assertSame($base['score'] - 20, $verified['score']);
    }

    public function testScoreIsClamped(): void
    {
        $r = RiskScorer::score([
            'account_age_hours' => 0,
            'has_photo' => false,
            'reports_count' => 100,
            'swipes_last_hour' => 999,
            'bio' => 'Contacte moi sur whatsapp +33612345678 pour gagner de l\'argent',
        ]);
        $this->assertLessThanOrEqual(100, $r['score']);
        $this->assertSame('high', $r['level']);
    }
}

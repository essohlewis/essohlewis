<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Verification\HeuristicLivenessChecker;
use PHPUnit\Framework\TestCase;

/** Pré-vérification heuristique des selfies (Phase 4, Sprint +10). */
final class LivenessCheckerTest extends TestCase
{
    private array $tmp = [];

    protected function setUp(): void
    {
        if (!extension_loaded('gd')) {
            $this->markTestSkipped('Extension GD indisponible.');
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->tmp as $f) {
            @unlink($f);
        }
    }

    /** Génère un JPEG bruité (octets réalistes) aux dimensions données. */
    private function makeImage(int $w, int $h): string
    {
        $img = imagecreatetruecolor($w, $h);
        for ($i = 0; $i < 4000; $i++) {
            $c = imagecolorallocate($img, random_int(0, 255), random_int(0, 255), random_int(0, 255));
            imagefilledrectangle($img, random_int(0, $w), random_int(0, $h), random_int(0, $w), random_int(0, $h), $c);
        }
        $path = sys_get_temp_dir() . '/amoura-selfie-' . uniqid() . '.jpg';
        imagejpeg($img, $path, 92);
        imagedestroy($img);
        $this->tmp[] = $path;
        return $path;
    }

    public function testValidPortraitPasses(): void
    {
        $r = (new HeuristicLivenessChecker())->analyze($this->makeImage(400, 520));
        $this->assertTrue($r['passed']);
        $this->assertGreaterThanOrEqual(HeuristicLivenessChecker::PASS_THRESHOLD, $r['score']);
        $this->assertNotContains('too_small', $r['flags']);
        $this->assertNotContains('not_portrait', $r['flags']);
    }

    public function testTooSmallIsFlaggedAndFails(): void
    {
        $r = (new HeuristicLivenessChecker())->analyze($this->makeImage(120, 120));
        $this->assertContains('too_small', $r['flags']);
        $this->assertFalse($r['passed']);
    }

    public function testWideBannerIsNotPortrait(): void
    {
        $r = (new HeuristicLivenessChecker())->analyze($this->makeImage(900, 220));
        $this->assertContains('not_portrait', $r['flags']);
    }

    public function testNonImageScoresZero(): void
    {
        $path = sys_get_temp_dir() . '/amoura-notimg-' . uniqid() . '.txt';
        file_put_contents($path, 'ceci n\'est pas une image');
        $this->tmp[] = $path;

        $r = (new HeuristicLivenessChecker())->analyze($path);
        $this->assertSame(0, $r['score']);
        $this->assertContains('not_an_image', $r['flags']);
        $this->assertFalse($r['passed']);
    }

    public function testMissingFileScoresZero(): void
    {
        $r = (new HeuristicLivenessChecker())->analyze('/nexiste/pas.jpg');
        $this->assertSame(0, $r['score']);
        $this->assertContains('file_missing', $r['flags']);
    }
}

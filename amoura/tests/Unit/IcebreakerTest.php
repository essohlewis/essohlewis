<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Icebreaker\HeuristicIcebreakerGenerator;
use PHPUnit\Framework\TestCase;

/** Générateur de brise-glaces heuristique (Phase 6, Sprint +14). */
final class IcebreakerTest extends TestCase
{
    private HeuristicIcebreakerGenerator $gen;

    protected function setUp(): void
    {
        $this->gen = new HeuristicIcebreakerGenerator();
    }

    public function testSharedInterestIsPrioritised(): void
    {
        $me = ['interests' => ['Randonnée', 'Cuisine', 'Cinéma']];
        $them = ['display_name' => 'Awa', 'interests' => ['cuisine', 'voyage']];

        $out = $this->gen->suggest($me, $them, 3);
        $this->assertCount(3, $out);
        // Le point commun « cuisine » apparaît dans la 1re suggestion (personnalisée au prénom).
        $this->assertStringContainsStringIgnoringCase('cuisine', $out[0]);
        $this->assertStringStartsWith('Awa,', $out[0]);
    }

    public function testUsesTheirInterestWhenNoOverlap(): void
    {
        $me = ['interests' => ['sport']];
        $them = ['interests' => ['photographie']];
        $out = $this->gen->suggest($me, $them, 5);
        $joined = implode(' | ', $out);
        $this->assertStringContainsStringIgnoringCase('photographie', $joined);
    }

    public function testCityAndJobProduceOpeners(): void
    {
        $them = ['city' => 'Abidjan', 'job_title' => 'architecte'];
        $joined = implode(' | ', $this->gen->suggest([], $them, 6));
        $this->assertStringContainsString('Abidjan', $joined);
        $this->assertStringContainsString('architecte', $joined);
    }

    public function testFallsBackWhenProfileEmpty(): void
    {
        $out = $this->gen->suggest([], [], 3);
        $this->assertCount(3, $out, 'toujours des suggestions grâce au repli');
        foreach ($out as $s) {
            $this->assertNotSame('', trim($s));
        }
    }

    public function testResultsAreDistinctAndRespectLimit(): void
    {
        $me = ['interests' => ['musique', 'danse']];
        $them = ['display_name' => 'Koffi', 'interests' => ['musique', 'danse', 'lecture'], 'city' => 'Dakar'];
        $out = $this->gen->suggest($me, $them, 4);
        $this->assertCount(4, $out);
        $this->assertSame($out, array_values(array_unique($out)), 'aucune répétition');
    }

    public function testInterestsAcceptJsonString(): void
    {
        // fullProfile renvoie interests en JSON : le générateur doit le décoder.
        $me = ['interests' => json_encode(['yoga'])];
        $them = ['interests' => json_encode(['yoga', 'thé'])];
        $out = $this->gen->suggest($me, $them, 2);
        $this->assertStringContainsStringIgnoringCase('yoga', $out[0]);
    }
}

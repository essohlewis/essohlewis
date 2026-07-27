<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Matching\TasteProfile;
use PHPUnit\Framework\TestCase;

/** Apprentissage implicite des préférences de matching (Phase 6, Sprint +15). */
final class TasteProfileTest extends TestCase
{
    /** @return array<int,array> N profils identiques. */
    private function profiles(int $n, int $age, bool $verified, array $interests): array
    {
        return array_fill(0, $n, ['age' => $age, 'is_verified' => $verified, 'interests' => $interests]);
    }

    public function testNoSignalBelowThreshold(): void
    {
        $taste = TasteProfile::learn($this->profiles(2, 25, true, ['a']), []);
        $this->assertFalse($taste['has_signal']);
        // Sans signal, tout candidat est neutre.
        $this->assertSame(0.5, TasteProfile::score(['age' => 25, 'interests' => ['a']], $taste));
    }

    public function testLearnsPreferredAgeVerifiedAndInterests(): void
    {
        $liked = $this->profiles(5, 25, true, ['tennis']);
        $passed = $this->profiles(3, 45, false, ['golf']);
        $taste = TasteProfile::learn($liked, $passed);

        $this->assertTrue($taste['has_signal']);
        $this->assertEqualsWithDelta(25.0, $taste['preferred_age'], 0.001);
        $this->assertSame(1.0, $taste['verified_pref'], 'tous les vérifiés rencontrés ont été aimés');
        $this->assertArrayHasKey('tennis', $taste['interest_weights']);
        $this->assertEqualsWithDelta(1.0, $taste['interest_weights']['tennis'], 0.001);
    }

    public function testScoreRewardsMatchingCandidate(): void
    {
        $taste = TasteProfile::learn(
            $this->profiles(5, 25, true, ['tennis']),
            $this->profiles(3, 45, false, ['golf'])
        );

        $match = TasteProfile::score(['age' => 25, 'is_verified' => true, 'interests' => ['tennis']], $taste);
        $anti = TasteProfile::score(['age' => 46, 'is_verified' => false, 'interests' => ['golf']], $taste);

        $this->assertGreaterThan(0.8, $match);
        $this->assertLessThan(0.2, $anti);
        $this->assertGreaterThan($anti, $match);
    }

    public function testVerifiedPreferenceCanBeNegative(): void
    {
        // Un membre qui passe systématiquement les profils vérifiés.
        $taste = TasteProfile::learn(
            $this->profiles(5, 30, false, ['x']),   // aime des non vérifiés
            $this->profiles(5, 30, true, ['y'])     // passe des vérifiés
        );
        $this->assertSame(0.0, $taste['verified_pref']);
        // Un candidat NON vérifié est alors mieux noté sur cette composante.
        $nonVerified = TasteProfile::score(['is_verified' => false], $taste);
        $verified = TasteProfile::score(['is_verified' => true], $taste);
        $this->assertGreaterThan($verified, $nonVerified);
    }
}

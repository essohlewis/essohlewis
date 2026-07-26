<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Recommender;
use PHPUnit\Framework\TestCase;

final class RecommenderTest extends TestCase
{
    public function testSharedInterestsIncreaseScore(): void
    {
        $viewer = ['interests' => ['voyage', 'musique', 'sport']];
        $withShared = Recommender::score($viewer, ['interests' => ['voyage', 'musique']]);
        $withNone   = Recommender::score($viewer, ['interests' => ['cuisine']]);
        $this->assertGreaterThan($withNone, $withShared);
    }

    public function testInterestMatchingIsCaseInsensitive(): void
    {
        $s = Recommender::score(['interests' => ['Voyage']], ['interests' => ['voyage']]);
        $this->assertGreaterThan(0, $s);
    }

    public function testSameCityBeatsSameCountry(): void
    {
        $viewer = ['city' => 'Abidjan', 'country' => 'CI'];
        $sameCity = Recommender::score($viewer, ['city' => 'Abidjan', 'country' => 'CI']);
        $sameCountryOnly = Recommender::score($viewer, ['city' => 'Bouaké', 'country' => 'CI']);
        $this->assertGreaterThan($sameCountryOnly, $sameCity);
    }

    public function testOnlineAndVerifiedBoostScore(): void
    {
        $base = Recommender::score([], ['interests' => []]);
        $boosted = Recommender::score([], ['interests' => [], 'is_online' => true, 'is_verified' => true]);
        $this->assertGreaterThan($base, $boosted);
    }

    public function testCloserDistanceScoresHigher(): void
    {
        $near = Recommender::score([], ['distance_km' => 2]);
        $far  = Recommender::score([], ['distance_km' => 150]);
        $this->assertGreaterThan($far, $near);
    }

    public function testAgeProximityRewarded(): void
    {
        $viewer = ['age' => 30];
        $close = Recommender::score($viewer, ['age' => 31]);
        $farApart = Recommender::score($viewer, ['age' => 55]);
        $this->assertGreaterThan($farApart, $close);
    }

    public function testRankSortsByAffinityDescending(): void
    {
        $viewer = ['interests' => ['a', 'b', 'c'], 'city' => 'Paris'];
        $candidates = [
            ['id' => 1, 'interests' => []],
            ['id' => 2, 'interests' => ['a', 'b', 'c'], 'city' => 'Paris', 'is_verified' => true],
            ['id' => 3, 'interests' => ['a']],
        ];
        $ranked = Recommender::rank($viewer, $candidates);
        $this->assertSame(2, $ranked[0]['id'], 'le plus affine passe en tête');
        $this->assertArrayHasKey('affinity', $ranked[0]);
        $this->assertGreaterThanOrEqual($ranked[1]['affinity'], $ranked[0]['affinity']);
        $this->assertGreaterThanOrEqual($ranked[2]['affinity'], $ranked[1]['affinity']);
    }
}

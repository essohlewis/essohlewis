<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Matching;
use Amoura\Models\Profile;
use Amoura\Services\Recommender;

/**
 * Vérifie de bout en bout que la découverte reclassée par affinité met en avant
 * les profils partageant des intérêts avec l'observateur.
 */
final class RecommendationTest extends IntegrationTestCase
{
    public function testSharedInterestProfileRanksFirst(): void
    {
        $me = $this->makeUser('viewer@test.io');
        (new Profile())->upsert($me, ['interests' => json_encode(['voyage', 'musique', 'cuisine']), 'city' => 'Abidjan']);

        $match = $this->makeUser('affine@test.io', 'male');
        (new Profile())->upsert($match, ['interests' => json_encode(['voyage', 'musique', 'cuisine']), 'city' => 'Abidjan']);

        $stranger = $this->makeUser('etranger@test.io', 'male');
        (new Profile())->upsert($stranger, ['interests' => json_encode(['jeux']), 'city' => 'Bouaké']);

        // Vivier brut depuis la découverte.
        $candidates = (new Matching())->discover($me, [], 60);
        $candidates = array_map(function ($c) {
            $c['interests'] = json_decode($c['interests'] ?? '[]', true) ?: [];
            $c['age'] = 30;
            return $c;
        }, $candidates);

        $viewer = ['interests' => ['voyage', 'musique', 'cuisine'], 'city' => 'Abidjan', 'age' => 30];
        $ranked = Recommender::rank($viewer, $candidates);

        $this->assertNotEmpty($ranked);
        $this->assertSame($match, (int) $ranked[0]['id'], 'le profil très affine doit être en tête');
        // L'affinité du premier dépasse celle du dernier.
        $this->assertGreaterThan(end($ranked)['affinity'], $ranked[0]['affinity']);
    }
}

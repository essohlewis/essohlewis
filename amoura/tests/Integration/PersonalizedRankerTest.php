<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Swipe;
use Amoura\Services\Matching\PersonalizedRanker;

/**
 * Reclassement personnalisé par apprentissage implicite (Phase 6, Sprint +15).
 * Vérifie l'apprentissage depuis l'historique de swipes réel + le reclassement.
 */
final class PersonalizedRankerTest extends IntegrationTestCase
{
    /** Crée un utilisateur cible avec âge/vérif/intérêts contrôlés. */
    private function target(string $email, string $birthdate, bool $verified, array $interests): int
    {
        $id = $this->makeUser($email, 'male');
        $this->db->prepare('UPDATE users SET birthdate = ?, is_verified = ? WHERE id = ?')
                 ->execute([$birthdate, $verified ? 1 : 0, $id]);
        $this->db->prepare('UPDATE profiles SET interests = ? WHERE user_id = ?')
                 ->execute([json_encode($interests), $id]);
        return $id;
    }

    public function testLearnedTastePromotesMatchingCandidate(): void
    {
        $me = $this->makeUser('learner@test.io');
        $swipe = new Swipe();

        // Historique : aime jeunes + vérifiés + « tennis » ; passe plus âgés + « golf ».
        foreach (range(1, 3) as $i) {
            $swipe->act($me, $this->target("y{$i}@test.io", '2000-01-01', true, ['tennis']), 'like');
        }
        foreach (range(1, 3) as $i) {
            $swipe->act($me, $this->target("o{$i}@test.io", '1980-01-01', false, ['golf']), 'pass');
        }

        // Deux candidats : B a une meilleure affinité brute mais ne colle pas au goût.
        $candidateA = ['id' => 101, 'affinity' => 10.0, 'age' => 25, 'is_verified' => true, 'interests' => ['tennis']];
        $candidateB = ['id' => 102, 'affinity' => 12.0, 'age' => 45, 'is_verified' => false, 'interests' => ['golf']];

        $ranked = PersonalizedRanker::rerank($me, [$candidateB, $candidateA]);

        $this->assertSame(101, $ranked[0]['id'], 'le candidat conforme au goût appris remonte en tête');
        $this->assertGreaterThan($ranked[1]['personalized'], $ranked[0]['personalized']);
        $this->assertArrayHasKey('taste', $ranked[0]);
    }

    public function testNoSignalKeepsAffinityOrder(): void
    {
        $me = $this->makeUser('newbie@test.io');
        // Un seul swipe → sous le seuil de signal.
        $swipe = new Swipe();
        $swipe->act($me, $this->target('t1@test.io', '2000-01-01', true, ['tennis']), 'like');

        // Candidats fournis dans l'ordre d'affinité (comme le Recommender les rend).
        $b = ['id' => 2, 'affinity' => 20.0, 'age' => 40, 'is_verified' => false, 'interests' => ['golf']];
        $a = ['id' => 1, 'affinity' => 10.0, 'age' => 25, 'is_verified' => true, 'interests' => ['tennis']];

        $ranked = PersonalizedRanker::rerank($me, [$b, $a]);
        // Sans signal, l'ordre reçu est conservé tel quel et aucun score n'est ajouté.
        $this->assertSame(2, $ranked[0]['id']);
        $this->assertArrayNotHasKey('personalized', $ranked[0]);
    }
}

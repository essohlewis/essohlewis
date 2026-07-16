<?php

class CoachModelTest extends ApiTestCase
{
    public function testRechercheParSpecialite(): void
    {
        $this->creerCoach('c1', 'musculation');
        $this->creerCoach('c2', 'yoga');

        $this->assertCount(1, (new Coach())->rechercher(['specialite' => 'musculation']));
        $this->assertCount(1, (new Coach())->rechercher(['specialite' => 'yoga']));
        $this->assertCount(0, (new Coach())->rechercher(['specialite' => 'danse']));
        $this->assertCount(2, (new Coach())->rechercher([])); // sans filtre
    }

    public function testRemplacerTarifsRemplaceToutLeJeu(): void
    {
        $this->creerCoach('c1');
        $c = new Coach();
        $c->remplacerTarifs('c1', [
            ['nom' => 'Solo', 'type' => 'seance', 'prix' => 12000, 'duree' => 60],
            ['nom' => 'Pack', 'type' => 'pack', 'prix' => 100000, 'duree' => 60],
        ]);
        $this->assertCount(2, $c->complet('c1')['tarifs']);

        // Un nouvel appel remplace intégralement (pas d'accumulation).
        $c->remplacerTarifs('c1', [['nom' => 'Unique', 'prix' => 5000]]);
        $tarifs = $c->complet('c1')['tarifs'];
        $this->assertCount(1, $tarifs);
        $this->assertSame('Unique', $tarifs[0]['nom']);
    }

    public function testBasculerLikeParUtilisateur(): void
    {
        $this->creerCoach('c1');
        $pdo = Database::connexion();
        $pdo->prepare("INSERT INTO posts (coach_id, texte, likes, date) VALUES (?,?,?,?)")
            ->execute(['c1', 'Bonjour', 10, '2026-01-01']);
        $postId = (int) $pdo->lastInsertId();
        $c = new Coach();

        // L'utilisateur 7 aime → +1 et aime=true.
        $r1 = $c->basculerLike($postId, 7);
        $this->assertSame(11, $r1['likes']);
        $this->assertTrue($r1['aime']);

        // Re-clic du même utilisateur → retour à l'état initial.
        $r2 = $c->basculerLike($postId, 7);
        $this->assertSame(10, $r2['likes']);
        $this->assertFalse($r2['aime']);

        // Deux utilisateurs distincts → +2.
        $c->basculerLike($postId, 7);
        $c->basculerLike($postId, 8);
        $this->assertSame(12, (int) $c->complet('c1')['posts'][0]['likes']);
        $this->assertEqualsCanonicalizing([$postId], $c->likesDe(7));
    }
}

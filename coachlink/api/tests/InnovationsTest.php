<?php

class InnovationsTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        foreach (['defis', 'evaluations_client', 'mesures'] as $t) {
            Database::connexion()->exec("DELETE FROM $t");
        }
    }

    public function testDefiCreationEtValidation(): void
    {
        $m = new Defi();
        $d = $m->creer(['coachId' => 'c1', 'coachNom' => 'Koffi A', 'clientId' => 7, 'clientNom' => 'Awa', 'titre' => '3 séances', 'echeance' => 'cette semaine']);
        $id = (int) $d['id'];
        $this->assertSame('propose', $d['statut']);
        $this->assertCount(1, $m->parClient(7));
        $this->assertCount(1, $m->parCoach('c1'));

        $maj = $m->changerStatut($id, 'reussi');
        $this->assertSame('reussi', $maj['statut']);
        $this->assertNotEmpty($maj['valide_le']);
    }

    public function testEvaluationClient(): void
    {
        $m = new EvaluationClient();
        $m->ajouter(9, ['coachId' => 'c1', 'coachNom' => 'Koffi', 'note' => 5, 'texte' => 'Ponctuel']);
        $m->ajouter(9, ['coachId' => 'c2', 'coachNom' => 'Ama', 'note' => 4, 'texte' => 'Sérieux']);
        $l = $m->parClient(9);
        $this->assertCount(2, $l);
        $moy = array_sum(array_map(fn($e) => (int) $e['note'], $l)) / count($l);
        $this->assertSame(4.5, $moy);
    }

    public function testMesuresSante(): void
    {
        $m = new Mesure();
        $m->ajouter(3, ['poids' => 82, 'tourTaille' => 90, 'date' => '2026-07-01T00:00:00+00:00']);
        $m->ajouter(3, ['poids' => 79.5, 'tourTaille' => 87, 'date' => '2026-07-08T00:00:00+00:00']);
        $l = $m->parClient(3);
        $this->assertCount(2, $l);
        // Triées par date croissante : la première mesure d'abord.
        $this->assertSame('82', (string) (int) $l[0]['poids']);
        $this->assertSame(0, count($m->parClient(999)));
    }

    public function testProgrammeExercicesAbonnement(): void
    {
        [$coachId, $clientId] = $this->contexte();
        $ab = new Abonnement();
        $a = $ab->creer(['clientId' => $clientId, 'coachId' => $coachId, 'objectif' => 'Forme', 'seancesSemaine' => 1, 'prixSeance' => 10000]);
        $id = (int) $a['id'];
        $maj = $ab->definirExercices($id, [
            ['nom' => 'Squats', 'series' => '4', 'repetitions' => '12', 'repos' => '60s', 'note' => ''],
            ['nom' => 'Pompes', 'series' => '3', 'repetitions' => '15', 'repos' => '45s', 'note' => ''],
        ]);
        $this->assertCount(2, $maj['exercices']);
        $this->assertSame('Squats', $maj['exercices'][0]['nom']);
    }

    /** Contexte coach + client (repris du style des autres tests). */
    private function contexte(): array
    {
        $coachId = $this->creerCoach('cX');
        $clientId = (new User())->creer(['role' => 'client', 'prenom' => 'Cl', 'nom' => 'Ie', 'email' => 'cl_' . uniqid() . '@t.ci', 'motDePasse' => 'secret123']);
        return [$coachId, (int) $clientId];
    }
}

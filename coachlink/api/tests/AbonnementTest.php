<?php

class AbonnementTest extends ApiTestCase
{
    private function contexte(): array
    {
        $this->creerCoach('c1');
        $clientId = (new User())->creer([
            'role' => 'client', 'prenom' => 'Awa', 'nom' => 'K', 'email' => 'abo@t.ci', 'motDePasse' => 'secret123',
        ]);
        return ['c1', $clientId];
    }

    public function testCreationDemandeEtPrixMensuel(): void
    {
        [$coachId, $clientId] = $this->contexte();
        $m = new Abonnement();
        $a = $m->creer([
            'clientId' => $clientId, 'clientNom' => 'Awa K', 'coachId' => $coachId, 'coachNom' => 'Koffi Aka',
            'objectif' => 'Perte de poids', 'seancesSemaine' => 3, 'lieuType' => 'domicile',
            'ville' => 'Abidjan', 'commune' => 'Cocody', 'lat' => '5.35', 'lng' => '-3.99',
            'prixSeance' => 10000, 'fixePar' => 'client',
        ]);
        $this->assertSame('demande', $a['statut']);
        $this->assertSame(120000, (int) $a['prix_mensuel']); // 10000 × 3 × 4
        $this->assertSame('domicile', $a['lieu_type']);
        $this->assertSame('5.35', $a['lat']);
        $this->assertCount(1, $m->parClient($clientId));
        $this->assertCount(1, $m->parCoach($coachId));
    }

    public function testProgrammeParLeCoachPasseEnPropose(): void
    {
        [$coachId, $clientId] = $this->contexte();
        $m = new Abonnement();
        $a = $m->creer(['clientId' => $clientId, 'coachId' => $coachId, 'objectif' => 'Forme', 'seancesSemaine' => 2, 'prixSeance' => 8000]);

        $a = $m->definirProgramme((int) $a['id'], [
            'programme' => ['Lun' => ['08:00'], 'Mer' => ['18:00']],
            'seancesSemaine' => 2, 'prixSeance' => 12000,
        ]);
        $this->assertSame('propose', $a['statut']);
        $this->assertSame(96000, (int) $a['prix_mensuel']); // 12000 × 2 × 4
        $this->assertArrayHasKey('Lun', $a['programme']);
        $this->assertSame(['08:00'], $a['programme']['Lun']);
        // Le coach signe le contrat en proposant les termes.
        $this->assertNotEmpty($a['contrat_ref']);
        $this->assertNotEmpty($a['contrat_coach_le']);
        $this->assertEmpty($a['contrat_client_le']);
    }

    public function testContratSigneParLesDeuxParties(): void
    {
        [$coachId, $clientId] = $this->contexte();
        $m = new Abonnement();
        $a = $m->creer(['clientId' => $clientId, 'coachId' => $coachId, 'objectif' => 'Forme', 'seancesSemaine' => 1, 'prixSeance' => 15000]);
        $id = (int) $a['id'];
        $a = $m->definirProgramme($id, ['programme' => ['Mar' => ['10:00']], 'seancesSemaine' => 1, 'prixSeance' => 15000]);
        $ref = $a['contrat_ref'];
        // Le client accepte en activant : sa signature est horodatée, la référence est conservée.
        $m->changerStatut($id, 'actif');
        $final = $m->trouver($id);
        $this->assertSame($ref, $final['contrat_ref']);
        $this->assertNotEmpty($final['contrat_client_le']);
        $this->assertNotEmpty($final['contrat_coach_le']);
    }

    public function testActivationEtReglementMensuel(): void
    {
        [$coachId, $clientId] = $this->contexte();
        $m = new Abonnement();
        $a = $m->creer(['clientId' => $clientId, 'coachId' => $coachId, 'objectif' => 'Forme', 'seancesSemaine' => 1, 'prixSeance' => 15000]);
        $id = (int) $a['id'];

        $this->assertFalse($m->moisRegle($id, '2026-07'));
        $m->changerStatut($id, 'actif');
        $this->assertNotEmpty($m->trouver($id)['date_debut']);

        $a = $m->enregistrerPaiement($id, ['mois' => '2026-07', 'montant' => 60000, 'operateur' => 'orange', 'reference' => 'AB123']);
        $this->assertTrue($m->moisRegle($id, '2026-07'));
        $this->assertCount(1, $a['paiements']);
        $this->assertSame('2026-07', $a['paiements'][0]['mois']);
    }
}

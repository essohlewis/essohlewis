<?php

class ReservationFlowTest extends ApiTestCase
{
    public function testCreationStatutEtPaiement(): void
    {
        $this->creerCoach('c1');
        $clientId = (new User())->creer([
            'role' => 'client', 'prenom' => 'Awa', 'nom' => 'K', 'email' => 'awa@t.ci', 'motDePasse' => 'secret123',
        ]);

        $r = new Reservation();
        $resa = $r->creer([
            'coachId' => 'c1', 'clientId' => $clientId, 'clientNom' => 'Awa K',
            'tarifId' => 't1', 'tarifNom' => 'Solo', 'prix' => 10000, 'duree' => 60,
            'jour' => 'Lun', 'heure' => '10:00', 'message' => 'Bonjour',
        ]);
        $this->assertSame('en_attente', $resa['statut']);
        $this->assertCount(1, $r->parClient($clientId));
        $this->assertCount(1, $r->parCoach('c1'));

        // Transition de statut.
        $r->changerStatut((int) $resa['id'], 'confirmee');
        $this->assertSame('confirmee', $r->trouver((int) $resa['id'])['statut']);
    }

    public function testLieuDuRendezVousPersiste(): void
    {
        $this->creerCoach('c1');
        $clientId = (new User())->creer([
            'role' => 'client', 'prenom' => 'N', 'nom' => 'D', 'email' => 'n@d.ci', 'motDePasse' => 'secret123',
        ]);
        $r = new Reservation();
        // Ex. nutritionniste : rendez-vous au domicile de la cliente, géolocalisé.
        $resa = $r->creer([
            'coachId' => 'c1', 'clientId' => $clientId, 'clientNom' => 'N D',
            'tarifId' => 't1', 'tarifNom' => 'Consultation', 'prix' => 15000, 'duree' => 45,
            'jour' => 'Mer', 'heure' => '11:00',
            'lieuType' => 'domicile', 'adresse' => 'Rue L112', 'ville' => 'Abidjan',
            'commune' => 'Cocody', 'quartier' => 'Riviera 3', 'lat' => '5.3600', 'lng' => '-3.9900',
        ]);
        $frais = $r->trouver((int) $resa['id']);
        $this->assertSame('domicile', $frais['lieu_type']);
        $this->assertSame('Cocody', $frais['commune']);
        $this->assertSame('Riviera 3', $frais['quartier']);
        $this->assertSame('5.3600', $frais['lat']);
        $this->assertSame('-3.9900', $frais['lng']);

        // Le coach ajuste ensuite le lieu (ex. propose son cabinet).
        $maj = $r->majLieu((int) $resa['id'], [
            'lieuType' => 'cabinet_coach', 'ville' => 'Abidjan', 'commune' => 'Plateau',
        ]);
        $this->assertSame('cabinet_coach', $maj['lieu_type']);
        $this->assertSame('Plateau', $maj['commune']);
    }

    public function testPaiementAvecRemisePromo(): void
    {
        $this->creerCoach('c1');
        $clientId = (new User())->creer([
            'role' => 'client', 'prenom' => 'B', 'nom' => 'C', 'email' => 'b@c.ci', 'motDePasse' => 'secret123',
        ]);
        $r = new Reservation();
        $resa = $r->creer([
            'coachId' => 'c1', 'clientId' => $clientId, 'clientNom' => 'B C',
            'tarifId' => 't1', 'tarifNom' => 'Solo', 'prix' => 10000, 'duree' => 60,
            'jour' => 'Mar', 'heure' => '09:00',
        ]);

        $paye = $r->payer((int) $resa['id'], [
            'operateur' => 'orange', 'numero' => '0700000000', 'promoTaux' => 10, 'promoCode' => 'BIENVENUE10',
        ]);
        $this->assertSame(1, (int) $paye['paye']);
        $this->assertSame(1000, (int) $paye['paiement_remise']);   // 10 % de 10000
        $this->assertSame(9000, (int) $paye['paiement_montant']);  // net à payer
        $this->assertNotEmpty($paye['paiement_ref']);
    }
}

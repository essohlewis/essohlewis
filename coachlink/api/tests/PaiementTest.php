<?php

class PaiementTest extends ApiTestCase
{
    public function testSimulateurAccepteUnCodeValide(): void
    {
        $r = (new PaiementSimulateur())->initier(['montant' => 10000, 'code' => '1234']);
        $this->assertSame('reussi', $r['statut']);
        $this->assertNotEmpty($r['reference']);
    }

    public function testSimulateurRefuseUnCodeInvalide(): void
    {
        $r = (new PaiementSimulateur())->initier(['montant' => 10000, 'code' => '12']);
        $this->assertSame('echoue', $r['statut']);
        $this->assertNull($r['reference']);
    }

    public function testServiceRetombeSurLeSimulateurSansConfig(): void
    {
        // La config de test ne définit pas 'paiement' → simulateur pour tout opérateur.
        $this->assertInstanceOf(PaiementSimulateur::class, PaiementService::pour('orange'));
        $this->assertInstanceOf(PaiementSimulateur::class, PaiementService::pour('wave'));
        $this->assertFalse(PaiementService::estReel('orange'));
    }

    public function testFluxPaiementViaPasserelleMarquePayee(): void
    {
        $this->creerCoach('c1');
        $clientId = (new User())->creer([
            'role' => 'client', 'prenom' => 'Awa', 'nom' => 'K', 'email' => 'pay@t.ci', 'motDePasse' => 'secret123',
        ]);
        $model = new Reservation();
        $resa = $model->creer([
            'coachId' => 'c1', 'clientId' => $clientId, 'clientNom' => 'Awa K',
            'tarifId' => 't1', 'tarifNom' => 'Solo', 'prix' => 20000, 'duree' => 60,
            'jour' => 'Lun', 'heure' => '10:00',
        ]);

        // Simule ce que fait le contrôleur : passerelle → succès → enregistrement.
        $tx = PaiementService::pour('orange')->initier([
            'referenceInterne' => (int) $resa['id'], 'montant' => 20000, 'code' => '4321',
        ]);
        $this->assertSame('reussi', $tx['statut']);

        $paye = $model->payer((int) $resa['id'], [
            'operateur' => 'orange', 'numero' => '0700000000', 'reference' => $tx['reference'],
        ]);
        $this->assertSame(1, (int) $paye['paye']);
        $this->assertSame($tx['reference'], $paye['paiement_ref']); // la réf de la passerelle est conservée
    }
}

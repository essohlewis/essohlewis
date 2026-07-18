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
        foreach (['orange', 'wave', 'mtn', 'moov'] as $op) {
            $this->assertInstanceOf(PaiementSimulateur::class, PaiementService::pour($op));
            $this->assertFalse(PaiementService::estReel($op));
        }
    }

    public function testLesQuatreOperateursImplemententLeContrat(): void
    {
        $this->assertInstanceOf(PaiementGateway::class, new PaiementOrangeMoney(['base_url' => 'http://127.0.0.1:2']));
        $this->assertInstanceOf(PaiementGateway::class, new PaiementWave(['base_url' => 'http://127.0.0.1:2']));
        $this->assertInstanceOf(PaiementGateway::class, new PaiementMtn(['base_url' => 'http://127.0.0.1:2']));
        $this->assertInstanceOf(PaiementGateway::class, new PaiementMoov(['base_url' => 'http://127.0.0.1:2']));
    }

    public function testMtnEchoueProprementSansServeur(): void
    {
        // Hôte injoignable → pas de jeton → échec propre (aucune exception).
        $r = (new PaiementMtn(['base_url' => 'http://127.0.0.1:2', 'api_user' => 'x', 'api_key' => 'y', 'subscription_key' => 'z']))
            ->initier(['referenceInterne' => 1, 'montant' => 1000, 'numero' => '0500000000']);
        $this->assertSame('echoue', $r['statut']);
    }

    public function testMoovEchoueProprementSansServeur(): void
    {
        $r = (new PaiementMoov(['base_url' => 'http://127.0.0.1:2', 'client_id' => 'x', 'client_secret' => 'y']))
            ->initier(['referenceInterne' => 1, 'montant' => 1000, 'numero' => '0100000000']);
        $this->assertSame('echoue', $r['statut']);
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

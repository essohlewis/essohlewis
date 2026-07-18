<?php

class PortefeuilleTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Database::connexion()->exec("DELETE FROM portefeuille_retraits");
    }

    public function testEnregistrerEtListerLesRetraits(): void
    {
        $this->creerCoach('cW');
        $p = new Portefeuille();

        $this->assertCount(0, $p->parCoach('cW'));

        $rt = $p->enregistrerRetrait('cW', 20000, 'Orange Money', '0700000000', 'RT12345678');
        $this->assertSame(20000, (int) $rt['montant']);
        $this->assertSame('effectue', $rt['statut']);
        $this->assertSame('Orange Money', $rt['operateur']);

        $p->enregistrerRetrait('cW', 5000, 'Wave', '0100000000', 'RT87654321');
        $liste = $p->parCoach('cW');
        $this->assertCount(2, $liste);
        // Un retrait pour un autre coach n'apparaît pas.
        $p->enregistrerRetrait('cAutre', 9999, 'MTN', '0500000000', 'RTxxxx');
        $this->assertCount(2, $p->parCoach('cW'));

        $total = array_sum(array_map(fn($r) => (int) $r['montant'], $p->parCoach('cW')));
        $this->assertSame(25000, $total);
    }
}

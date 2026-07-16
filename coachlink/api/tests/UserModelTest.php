<?php

class UserModelTest extends ApiTestCase
{
    public function testCreationHachageEtRecherche(): void
    {
        $m = new User();
        $id = $m->creer([
            'role' => 'client', 'prenom' => 'Awa', 'nom' => 'Koné',
            'email' => 'Awa@Test.CI', 'telephone' => '0700000000', 'motDePasse' => 'secret123',
        ]);
        $this->assertGreaterThan(0, $id);

        // L'email est normalisé en minuscules.
        $u = $m->parEmail('awa@test.ci');
        $this->assertNotNull($u);
        $this->assertSame('client', $u['role']);

        // Le mot de passe est haché (jamais stocké en clair).
        $this->assertNotSame('secret123', $u['mot_de_passe']);
        $this->assertTrue($m->verifierMotDePasse($u, 'secret123'));
        $this->assertFalse($m->verifierMotDePasse($u, 'mauvais'));
    }

    public function testRepresentationPubliqueSansHash(): void
    {
        $m = new User();
        $m->creer(['role' => 'client', 'prenom' => 'A', 'nom' => 'B', 'email' => 'a@b.ci', 'motDePasse' => 'secret123']);
        $u = $m->parEmail('a@b.ci');
        $public = User::public($u);
        $this->assertArrayNotHasKey('mot_de_passe', $public);
        $this->assertArrayHasKey('email', $public);
    }
}

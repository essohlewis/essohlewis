<?php

class MailTest extends ApiTestCase
{
    public function testTransportParDefautEstLeLog(): void
    {
        // La config de test ne définit pas 'mail' → transport 'log', pas réel.
        $this->assertInstanceOf(MailLog::class, MailService::transport());
        $this->assertFalse(MailService::estReel());
    }

    public function testLogEcritUnFichierEml(): void
    {
        $res = MailService::envoyer('awa@test.ci', 'Sujet de test', '<p>Bonjour</p>');
        $this->assertTrue($res['ok']);
        $this->assertArrayHasKey('fichier', $res);
        $this->assertFileExists($res['fichier']);
        $contenu = file_get_contents($res['fichier']);
        $this->assertStringContainsString('To: awa@test.ci', $contenu);
        $this->assertStringContainsString('Sujet de test', $contenu);
        $this->assertStringContainsString('<p>Bonjour</p>', $contenu);
        @unlink($res['fichier']);
    }

    public function testGabaritEchappeEtEnrobe(): void
    {
        $html = MailService::gabarit('Titre <danger>', '<p>corps</p>');
        $this->assertStringContainsString('CoachLink CI', $html);
        $this->assertStringContainsString('<p>corps</p>', $html);
        $this->assertStringContainsString('Titre &lt;danger&gt;', $html); // titre échappé
    }

    public function testLienFrontConstruitDepuisAppUrl(): void
    {
        // app_url vide en test → lien relatif commençant par le hash.
        $lien = MailService::lienFront('#/reinitialiser?token=abc');
        $this->assertStringContainsString('#/reinitialiser?token=abc', $lien);
    }

    public function testSmtpEchoueProprementSansServeur(): void
    {
        // Hôte injoignable → réponse ok=false sans exception (robustesse).
        $res = (new MailSmtp(['host' => '127.0.0.1', 'port' => 2, 'chiffrement' => '']))
            ->envoyer(['to' => 'x@y.ci', 'subject' => 'S', 'html' => '<p>h</p>', 'from' => 'a@b.ci']);
        $this->assertFalse($res['ok']);
        $this->assertNotEmpty($res['message']);
    }
}

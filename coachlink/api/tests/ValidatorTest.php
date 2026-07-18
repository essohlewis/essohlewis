<?php
use PHPUnit\Framework\TestCase;

class ValidatorTest extends TestCase
{
    public function testRequis(): void
    {
        $this->assertFalse((new Validator(['a' => '  ']))->requis('a')->valide());
        $this->assertTrue((new Validator(['a' => 'x']))->requis('a')->valide());
    }

    public function testEmail(): void
    {
        $this->assertTrue((new Validator(['e' => 'awa@test.ci']))->email('e')->valide());
        $this->assertFalse((new Validator(['e' => 'pas-un-email']))->email('e')->valide());
    }

    public function testTelephoneCI(): void
    {
        $this->assertTrue((new Validator(['t' => '0701020304']))->telephoneCI('t')->valide());
        $this->assertTrue((new Validator(['t' => '+225 05 01 02 03 04']))->telephoneCI('t')->valide());
        $this->assertFalse((new Validator(['t' => '0601020304']))->telephoneCI('t')->valide()); // préfixe invalide
        $this->assertFalse((new Validator(['t' => '07010203']))->telephoneCI('t')->valide());   // trop court
    }

    public function testMinEtDansListe(): void
    {
        $this->assertFalse((new Validator(['p' => '123']))->min('p', 6)->valide());
        $this->assertTrue((new Validator(['p' => '123456']))->min('p', 6)->valide());
        $this->assertFalse((new Validator(['r' => 'root']))->dansListe('r', ['client', 'coach'])->valide());
        $this->assertTrue((new Validator(['r' => 'coach']))->dansListe('r', ['client', 'coach'])->valide());
    }

    public function testChaineDeReglesCumuleLesErreurs(): void
    {
        $v = (new Validator(['email' => 'x', 'motDePasse' => '1']))
            ->email('email')->min('motDePasse', 6);
        $this->assertFalse($v->valide());
        $this->assertArrayHasKey('email', $v->erreurs());
        $this->assertArrayHasKey('motDePasse', $v->erreurs());
    }
}

<?php

class OtpTest extends \PHPUnit\Framework\TestCase
{
    public function testCodeAsixChiffresEtDeterministe(): void
    {
        $s = 'CLQR-42-a1b2c3d4e5f6a7b8';
        $c = Otp::code($s, 58888888);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $c);
        $this->assertSame($c, Otp::code($s, 58888888)); // déterministe
    }

    public function testCodeChangeChaqueFenetre(): void
    {
        $s = 'CLQR-7-deadbeefdeadbeef';
        $this->assertNotSame(Otp::code($s, 100), Otp::code($s, 101));
    }

    public function testValidationToleranceUneFenetre(): void
    {
        $s = 'CLQR-9-0011223344556677';
        $t = 60_000_000 * 30; // instant arbitraire (secondes) → fenêtre = 60 000 000
        $f = Otp::fenetre($t);

        // Fenêtre courante et ± 1 acceptées.
        $this->assertTrue(Otp::valide($s, Otp::code($s, $f), $t));
        $this->assertTrue(Otp::valide($s, Otp::code($s, $f - 1), $t));
        $this->assertTrue(Otp::valide($s, Otp::code($s, $f + 1), $t));

        // Au-delà de la tolérance → refusé (un code capturé expire).
        $this->assertFalse(Otp::valide($s, Otp::code($s, $f - 2), $t));
        $this->assertFalse(Otp::valide($s, Otp::code($s, $f + 2), $t));
    }

    public function testAccepteLePayloadCompletEtRejetteLeReste(): void
    {
        $s = 'CLQR-3-aabbccddeeff0011';
        $t = 42_000_000 * 30;
        $f = Otp::fenetre($t);
        $code = Otp::code($s, $f);

        // Le payload complet « CLQR-<fenetre>-<code> » est accepté (le code final compte).
        $this->assertTrue(Otp::valide($s, 'CLQR-' . $f . '-' . $code, $t));
        // Format invalide → refusé.
        $this->assertFalse(Otp::valide($s, 'abc', $t));
        $this->assertFalse(Otp::valide($s, '', $t));
    }
}

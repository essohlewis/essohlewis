<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Security\Totp;
use Amoura\Models\User;
use PHPUnit\Framework\TestCase;

final class TotpTest extends TestCase
{
    // Secret ASCII des vecteurs de test RFC 6238 (SHA1).
    private function rfcSecret(): string
    {
        return Totp::base32Encode('12345678901234567890');
    }

    public function testBase32RoundTrip(): void
    {
        $this->assertSame('12345678901234567890', Totp::base32Decode(Totp::base32Encode('12345678901234567890')));
    }

    public function testMatchesRfc6238Vectors(): void
    {
        $s = $this->rfcSecret();
        $this->assertSame('287082', Totp::codeAt($s, 59));           // RFC 8-digit 94287082
        $this->assertSame('081804', Totp::codeAt($s, 1111111109));   // RFC 8-digit 07081804
        $this->assertSame('005924', Totp::codeAt($s, 1234567890));   // RFC 8-digit 89005924
        $this->assertSame('279037', Totp::codeAt($s, 2000000000));   // RFC 8-digit 69279037
    }

    public function testVerifyAcceptsCurrentAndDriftedCodes(): void
    {
        $s = $this->rfcSecret();
        $now = 1600000000;
        $this->assertTrue(Totp::verify($s, Totp::codeAt($s, $now), 1, $now));
        $this->assertTrue(Totp::verify($s, Totp::codeAt($s, $now - 30), 1, $now)); // période précédente
        $this->assertTrue(Totp::verify($s, Totp::codeAt($s, $now + 30), 1, $now)); // période suivante
    }

    public function testVerifyRejectsWrongOrOutOfWindowCodes(): void
    {
        $s = $this->rfcSecret();
        $now = 1600000000;
        $this->assertFalse(Totp::verify($s, '000000', 1, $now));
        $this->assertFalse(Totp::verify($s, Totp::codeAt($s, $now - 120), 1, $now)); // trop ancien
        $this->assertFalse(Totp::verify($s, '12345', 1, $now)); // mauvaise longueur
    }

    public function testGeneratedSecretIsValidBase32(): void
    {
        $secret = Totp::generateSecret();
        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $secret);
        $this->assertGreaterThanOrEqual(16, strlen($secret));
    }

    public function testProvisioningUriFormat(): void
    {
        $uri = Totp::provisioningUri('ABC234', 'user@x.io', 'Amoura');
        $this->assertStringStartsWith('otpauth://totp/', $uri);
        $this->assertStringContainsString('secret=ABC234', $uri);
        $this->assertStringContainsString('issuer=Amoura', $uri);
    }

    public function testSessionValidityLogic(): void
    {
        // Pas de seuil de révocation → toujours valide.
        $this->assertTrue(User::isSessionValid(null, 1000));
        // Session établie avant le seuil → invalide.
        $revokedAt = date('Y-m-d H:i:s', 2000);
        $this->assertFalse(User::isSessionValid($revokedAt, 1500));
        // Session établie après le seuil → valide.
        $this->assertTrue(User::isSessionValid($revokedAt, 2500));
    }
}

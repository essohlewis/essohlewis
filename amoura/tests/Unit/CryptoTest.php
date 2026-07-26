<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Security\Crypto;
use PHPUnit\Framework\TestCase;

/**
 * Chiffrement au repos (Sprint +6). Vérifie l'aller-retour, la rétro-compatibilité
 * avec le texte clair et la non-déterministe (nonce aléatoire).
 */
final class CryptoTest extends TestCase
{
    protected function setUp(): void
    {
        if (!function_exists('sodium_crypto_secretbox')) {
            $this->markTestSkipped('Extension libsodium indisponible.');
        }
        putenv('APP_KEY=test-crypto-key-0123456789abcdef');
        $_ENV['APP_KEY'] = 'test-crypto-key-0123456789abcdef';
    }

    public function testRoundTrip(): void
    {
        $plain = "Bonjour, ceci est un message privé 💬";
        $cipher = Crypto::encrypt($plain);

        $this->assertNotSame($plain, $cipher, 'le chiffré diffère du clair');
        $this->assertTrue(Crypto::isEncrypted($cipher), 'le chiffré est préfixé');
        $this->assertSame($plain, Crypto::decrypt($cipher), 'le déchiffrement restitue le clair');
    }

    public function testPlaintextPassthrough(): void
    {
        // Un texte non chiffré (données existantes) est renvoyé tel quel.
        $legacy = 'ancien message en clair';
        $this->assertFalse(Crypto::isEncrypted($legacy));
        $this->assertSame($legacy, Crypto::decrypt($legacy));
    }

    public function testNonDeterministic(): void
    {
        // Deux chiffrements du même texte diffèrent (nonce aléatoire).
        $this->assertNotSame(Crypto::encrypt('même texte'), Crypto::encrypt('même texte'));
    }

    public function testEmptyString(): void
    {
        $this->assertSame('', Crypto::decrypt(Crypto::encrypt('')));
    }
}

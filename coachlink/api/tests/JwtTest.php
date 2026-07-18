<?php
use PHPUnit\Framework\TestCase;

class JwtTest extends TestCase
{
    public function testAllerRetour(): void
    {
        $token = Jwt::encoder(['sub' => 42, 'role' => 'client']);
        $payload = Jwt::decoder($token);
        $this->assertIsArray($payload);
        $this->assertSame(42, $payload['sub']);
        $this->assertSame('client', $payload['role']);
        $this->assertArrayHasKey('exp', $payload);
    }

    public function testSignatureAltereeRejetee(): void
    {
        $token = Jwt::encoder(['sub' => 1]);
        $this->assertNull(Jwt::decoder($token . 'altere'));
        $this->assertNull(Jwt::decoder('nimporte.quoi'));
    }

    public function testJetonExpireRejete(): void
    {
        // 'exp' fourni dans le payload écrase la valeur par défaut.
        $token = Jwt::encoder(['sub' => 1, 'exp' => time() - 10]);
        $this->assertNull(Jwt::decoder($token));
    }
}

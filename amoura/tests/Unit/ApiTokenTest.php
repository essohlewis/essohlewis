<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Models\ApiToken;
use PHPUnit\Framework\TestCase;

/**
 * Jetons d'accès API (Phase 5, Sprint +23) : logique pure de portées (abilities)
 * et d'empreinte du jeton. L'émission/résolution (I/O base) est couverte par le
 * test d'intégration.
 */
final class ApiTokenTest extends TestCase
{
    public function testHashIsDeterministicSha256(): void
    {
        $this->assertSame(hash('sha256', 'amoura_abc'), ApiToken::hashToken('amoura_abc'));
        $this->assertSame(64, strlen(ApiToken::hashToken('x')));
        $this->assertNotSame(ApiToken::hashToken('a'), ApiToken::hashToken('b'));
    }

    public function testWildcardStarAllowsEverything(): void
    {
        $this->assertTrue(ApiToken::allows(['*'], 'profile:read'));
        $this->assertTrue(ApiToken::allows(['*'], 'messages:write'));
    }

    public function testExactAbilityMatch(): void
    {
        $this->assertTrue(ApiToken::allows(['profile:read'], 'profile:read'));
        $this->assertFalse(ApiToken::allows(['profile:read'], 'profile:write'));
    }

    public function testNamespaceWildcard(): void
    {
        $this->assertTrue(ApiToken::allows(['messages:*'], 'messages:write'));
        $this->assertTrue(ApiToken::allows(['messages:*'], 'messages:read'));
        // Le joker de préfixe ne fuit pas sur un autre namespace.
        $this->assertFalse(ApiToken::allows(['messages:*'], 'profile:read'));
    }

    public function testEmptyAbilitiesDenies(): void
    {
        $this->assertFalse(ApiToken::allows([], 'profile:read'));
    }

    public function testAbilitiesOfToleratesJsonStringOrArrayOrNull(): void
    {
        $this->assertSame(['a', 'b'], ApiToken::abilitiesOf(['abilities' => '["a","b"]']));
        $this->assertSame(['x'], ApiToken::abilitiesOf(['abilities' => ['x']]));
        $this->assertSame([], ApiToken::abilitiesOf(['abilities' => null]));
        $this->assertSame([], ApiToken::abilitiesOf(['abilities' => 'not-json']));
        $this->assertSame([], ApiToken::abilitiesOf([]));
    }
}

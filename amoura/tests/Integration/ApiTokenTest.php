<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Request;
use Amoura\Core\Security\Auth;
use Amoura\Middleware\ApiAuthenticate;
use Amoura\Models\ApiToken;

/**
 * Jetons d'accès API (Phase 5, Sprint +23) : émission, résolution, expiration,
 * révocation, stockage haché et authentification stateless par le middleware.
 */
final class ApiTokenTest extends IntegrationTestCase
{
    protected function tearDown(): void
    {
        // Évite toute fuite de l'utilisateur authentifié entre les tests.
        $ref = new \ReflectionClass(Auth::class);
        foreach (['cache', 'apiToken'] as $prop) {
            $p = $ref->getProperty($prop);
            $p->setAccessible(true);
            $p->setValue(null, null);
        }
        unset($_SERVER['HTTP_AUTHORIZATION']);
    }

    public function testIssueReturnsPrefixedTokenAndStoresOnlyHash(): void
    {
        $uid = $this->makeUser('api1@example.com');
        $model = new ApiToken();
        $issued = $model->issue($uid, 'iPhone', ['*'], 3600);

        $this->assertStringStartsWith(ApiToken::PREFIX, $issued['token']);
        $this->assertNotNull($issued['expires_at']);

        // La base ne contient jamais le jeton en clair, seulement son empreinte.
        $row = $this->db->query('SELECT token_hash FROM api_tokens WHERE id = ' . (int) $issued['id'])->fetch();
        $this->assertSame(ApiToken::hashToken($issued['token']), $row['token_hash']);
        $this->assertStringNotContainsString($issued['token'], (string) $row['token_hash']);
    }

    public function testResolveValidTokenReturnsRowAndTracksUsage(): void
    {
        $uid = $this->makeUser('api2@example.com');
        $model = new ApiToken();
        $issued = $model->issue($uid, 'mobile', ['*'], 3600);

        $row = $model->resolve($issued['token']);
        $this->assertNotNull($row);
        $this->assertSame($uid, (int) $row['user_id']);
        // last_used_at renseigné à la première résolution.
        $fresh = $this->db->query('SELECT last_used_at FROM api_tokens WHERE id = ' . (int) $issued['id'])->fetch();
        $this->assertNotNull($fresh['last_used_at']);

        // Jeton inconnu → null.
        $this->assertNull($model->resolve('amoura_inexistant'));
        $this->assertNull($model->resolve(''));
    }

    public function testExpiredTokenIsRejected(): void
    {
        $uid = $this->makeUser('api3@example.com');
        $model = new ApiToken();
        $issued = $model->issue($uid, 'mobile', ['*'], 3600);
        // On force l'expiration dans le passé.
        $this->db->exec('UPDATE api_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ' . (int) $issued['id']);

        $this->assertNull($model->resolve($issued['token']));
    }

    public function testRevokeInvalidatesToken(): void
    {
        $uid = $this->makeUser('api4@example.com');
        $model = new ApiToken();
        $issued = $model->issue($uid, 'mobile', ['*'], 3600);

        $this->assertTrue($model->revoke((int) $issued['id'], $uid));
        $this->assertNull($model->resolve($issued['token']));
        // Révoquer le jeton d'un autre utilisateur échoue.
        $other = $model->issue($this->makeUser('api5@example.com'))['id'];
        $this->assertFalse($model->revoke((int) $other, $uid));
    }

    public function testMiddlewareAuthenticatesBearerToken(): void
    {
        $uid = $this->makeUser('api6@example.com');
        $issued = (new ApiToken())->issue($uid, 'mobile', ['*'], 3600);

        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $issued['token'];
        $ok = (new ApiAuthenticate())->handle(new Request(), []);

        $this->assertTrue($ok);
        $this->assertSame($uid, Auth::id());
        $this->assertSame($uid, (int) (Auth::user()['id'] ?? 0));
        $this->assertNotNull(Auth::apiToken());
        $this->assertTrue(Auth::tokenAllows('anything:goes')); // portée « * »
    }

    public function testPurgeExpiredRemovesOnlyExpired(): void
    {
        $uid = $this->makeUser('api7@example.com');
        $model = new ApiToken();
        $live = $model->issue($uid, 'live', ['*'], 3600)['id'];
        $dead = $model->issue($uid, 'dead', ['*'], 3600)['id'];
        $this->db->exec('UPDATE api_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ' . (int) $dead);

        $this->assertSame(1, $model->purgeExpired());
        $this->assertNotNull($this->db->query('SELECT id FROM api_tokens WHERE id = ' . (int) $live)->fetch());
        $this->assertFalse($this->db->query('SELECT id FROM api_tokens WHERE id = ' . (int) $dead)->fetch());
    }
}

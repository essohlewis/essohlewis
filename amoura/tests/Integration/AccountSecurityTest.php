<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Security\Totp;
use Amoura\Models\User;

/**
 * Sprint +4 : 2FA (TOTP) et révocation de sessions au niveau du modèle.
 */
final class AccountSecurityTest extends IntegrationTestCase
{
    public function testTotpEnableDisableLifecycle(): void
    {
        $uid = $this->makeUser('2fa@test.io');
        $model = new User();
        $secret = Totp::generateSecret();

        $model->setTotpSecret($uid, $secret);
        $u = $model->find($uid);
        $this->assertSame($secret, $u['totp_secret']);
        $this->assertSame(0, (int) $u['totp_enabled'], 'stocker le secret n\'active pas encore la 2FA');

        // Un code valide permet d'activer.
        $this->assertTrue(Totp::verify($secret, Totp::codeAt($secret)));
        $model->enableTotp($uid);
        $this->assertSame(1, (int) $model->find($uid)['totp_enabled']);

        // Désactivation : le secret est effacé.
        $model->disableTotp($uid);
        $after = $model->find($uid);
        $this->assertSame(0, (int) $after['totp_enabled']);
        $this->assertNull($after['totp_secret']);
    }

    public function testRevokeSessionsInvalidatesOlderSessions(): void
    {
        $uid = $this->makeUser('revoke@test.io');
        $model = new User();

        $beforeRevoke = time() - 100;  // une session « ancienne »
        $model->revokeSessions($uid);
        $validAfter = $model->find($uid)['sessions_valid_after'];
        $this->assertNotNull($validAfter);

        // Une session établie avant la révocation est invalide…
        $this->assertFalse(User::isSessionValid($validAfter, $beforeRevoke));
        // …une session établie maintenant reste valide.
        $this->assertTrue(User::isSessionValid($validAfter, time() + 1));
    }
}

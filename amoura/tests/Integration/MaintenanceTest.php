<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Services\Maintenance;

/**
 * Vérifie que la purge planifiée supprime bien les données expirées
 * sans toucher aux données encore valides.
 */
final class MaintenanceTest extends IntegrationTestCase
{
    public function testPurgesExpiredDataOnly(): void
    {
        $user = $this->makeUser('cronuser@test.io');

        // Story expirée (hier) + story active (demain).
        $this->db->prepare('INSERT INTO stories (user_id, type, caption, expires_at) VALUES (?, "text", "vieux", DATE_SUB(NOW(), INTERVAL 1 DAY))')->execute([$user]);
        $this->db->prepare('INSERT INTO stories (user_id, type, caption, expires_at) VALUES (?, "text", "actif", DATE_ADD(NOW(), INTERVAL 1 DAY))')->execute([$user]);

        // Jeton OTP expiré + jeton valide.
        $this->db->prepare('INSERT INTO auth_tokens (user_id, channel, purpose, destination, code_hash, expires_at) VALUES (?, "email", "verify", "x@x.io", "h", DATE_SUB(NOW(), INTERVAL 1 HOUR))')->execute([$user]);
        $this->db->prepare('INSERT INTO auth_tokens (user_id, channel, purpose, destination, code_hash, expires_at) VALUES (?, "email", "verify", "y@y.io", "h", DATE_ADD(NOW(), INTERVAL 1 HOUR))')->execute([$user]);

        // Session périmée + rate-limit périmé.
        $this->db->prepare('INSERT INTO sessions (id, user_id, last_activity) VALUES (?, ?, ?)')
            ->execute([str_repeat('a', 64), $user, time() - 40 * 86400]);
        $this->db->prepare('INSERT INTO rate_limits (bucket, hits, reset_at) VALUES ("old", 3, ?)')
            ->execute([time() - 100]);

        $deleted = Maintenance::run();

        $this->assertSame(1, $deleted['stories'], 'seule la story expirée doit partir');
        $this->assertSame(1, $deleted['auth_tokens']);
        $this->assertSame(1, $deleted['sessions']);
        $this->assertSame(1, $deleted['rate_limits']);

        // La donnée valide subsiste.
        $activeStories = (int) $this->db->query('SELECT COUNT(*) FROM stories')->fetchColumn();
        $this->assertSame(1, $activeStories);
        $validTokens = (int) $this->db->query('SELECT COUNT(*) FROM auth_tokens')->fetchColumn();
        $this->assertSame(1, $validTokens);
    }
}

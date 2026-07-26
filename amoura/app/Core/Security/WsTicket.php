<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

use Amoura\Core\Env;

/**
 * Ticket d'accès WebSocket à courte durée de vie.
 * Le HTTP (session) émet un ticket signé HMAC ; le serveur WebSocket, qui n'a
 * pas accès à la session PHP, le vérifie pour authentifier la connexion.
 */
final class WsTicket
{
    private const TTL = 60; // secondes

    private static function key(): string
    {
        $key = (string) Env::get('APP_KEY', '');
        return $key !== '' ? $key : 'insecure-dev-key-change-me';
    }

    public static function issue(int $userId): string
    {
        $expires = time() + self::TTL;
        $payload = $userId . '.' . $expires;
        $sig = hash_hmac('sha256', $payload, self::key());
        return base64_encode($payload . '.' . $sig);
    }

    /** @return int|null identifiant utilisateur si le ticket est valide et non expiré. */
    public static function verify(string $ticket): ?int
    {
        $decoded = base64_decode($ticket, true);
        if ($decoded === false) {
            return null;
        }
        $parts = explode('.', $decoded);
        if (count($parts) !== 3) {
            return null;
        }
        [$userId, $expires, $sig] = $parts;
        $expected = hash_hmac('sha256', $userId . '.' . $expires, self::key());
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        if ((int) $expires < time()) {
            return null;
        }
        return (int) $userId;
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Core\Realtime;

/**
 * Poignée de main WebSocket côté client (RFC 6455) — Phase 1, Sprint +8.
 * Génère la clé cliente et calcule/valide la clé d'acceptation serveur.
 */
final class Handshake
{
    /** GUID magique défini par la RFC 6455 (§1.3). */
    public const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    /** Clé Sec-WebSocket-Key aléatoire (16 octets → base64). */
    public static function clientKey(): string
    {
        return base64_encode(random_bytes(16));
    }

    /** Clé d'acceptation attendue pour une clé cliente donnée. */
    public static function acceptFor(string $clientKey): string
    {
        return base64_encode(sha1($clientKey . self::GUID, true));
    }

    /** Vérifie que la réponse serveur correspond bien à la clé envoyée. */
    public static function verify(string $clientKey, string $serverAccept): bool
    {
        return hash_equals(self::acceptFor($clientKey), trim($serverAccept));
    }

    /** Construit la requête d'ouverture HTTP/1.1 (Upgrade). */
    public static function request(string $host, int $port, string $path, string $clientKey): string
    {
        return "GET {$path} HTTP/1.1\r\n"
            . "Host: {$host}:{$port}\r\n"
            . "Upgrade: websocket\r\n"
            . "Connection: Upgrade\r\n"
            . "Sec-WebSocket-Key: {$clientKey}\r\n"
            . "Sec-WebSocket-Version: 13\r\n\r\n";
    }
}

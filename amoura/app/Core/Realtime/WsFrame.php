<?php
declare(strict_types=1);

namespace Amoura\Core\Realtime;

/**
 * Encodage/décodage de trames WebSocket (RFC 6455) — Phase 1, Sprint +8.
 * Utilisé par le client de test de charge (`scripts/ws_loadtest.php`) qui doit
 * masquer ses trames (obligation client) et lire les trames serveur (non masquées).
 * Pur et testable (aucune I/O).
 */
final class WsFrame
{
    public const OP_TEXT = 0x1;
    public const OP_BINARY = 0x2;
    public const OP_CLOSE = 0x8;
    public const OP_PING = 0x9;
    public const OP_PONG = 0xA;

    /** Encode une trame complète (FIN=1). Les clients DOIVENT masquer ($masked=true). */
    public static function encode(string $payload, int $opcode = self::OP_TEXT, bool $masked = true): string
    {
        $frame = chr(0x80 | ($opcode & 0x0F));       // FIN + opcode
        $len = strlen($payload);
        $maskBit = $masked ? 0x80 : 0x00;

        if ($len < 126) {
            $frame .= chr($maskBit | $len);
        } elseif ($len <= 0xFFFF) {
            $frame .= chr($maskBit | 126) . pack('n', $len);
        } else {
            // pack('J') : entier 64 bits gros-boutiste.
            $frame .= chr($maskBit | 127) . pack('J', $len);
        }

        if ($masked) {
            $mask = random_bytes(4);
            $frame .= $mask;
            for ($i = 0; $i < $len; $i++) {
                $payload[$i] = $payload[$i] ^ $mask[$i % 4];
            }
        }
        return $frame . $payload;
    }

    /**
     * Décode UNE trame en tête de tampon. Gère masqué et non masqué.
     * @return array{ok:bool, fin?:bool, opcode?:int, payload?:string, consumed?:int}
     *         ok=false si le tampon est incomplet (rappeler après plus de lecture).
     */
    public static function decode(string $buffer): array
    {
        $bufLen = strlen($buffer);
        if ($bufLen < 2) {
            return ['ok' => false];
        }
        $b0 = ord($buffer[0]);
        $b1 = ord($buffer[1]);
        $fin = (bool) ($b0 & 0x80);
        $opcode = $b0 & 0x0F;
        $masked = (bool) ($b1 & 0x80);
        $len = $b1 & 0x7F;
        $offset = 2;

        if ($len === 126) {
            if ($bufLen < $offset + 2) {
                return ['ok' => false];
            }
            $len = unpack('n', substr($buffer, $offset, 2))[1];
            $offset += 2;
        } elseif ($len === 127) {
            if ($bufLen < $offset + 8) {
                return ['ok' => false];
            }
            $len = unpack('J', substr($buffer, $offset, 8))[1];
            $offset += 8;
        }

        $mask = '';
        if ($masked) {
            if ($bufLen < $offset + 4) {
                return ['ok' => false];
            }
            $mask = substr($buffer, $offset, 4);
            $offset += 4;
        }

        if ($bufLen < $offset + $len) {
            return ['ok' => false]; // trame incomplète
        }
        $payload = substr($buffer, $offset, $len);
        if ($masked) {
            for ($i = 0; $i < $len; $i++) {
                $payload[$i] = $payload[$i] ^ $mask[$i % 4];
            }
        }
        return ['ok' => true, 'fin' => $fin, 'opcode' => $opcode, 'payload' => $payload, 'consumed' => $offset + $len];
    }
}

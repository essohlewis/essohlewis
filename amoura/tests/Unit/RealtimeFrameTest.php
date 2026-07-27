<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Realtime\Handshake;
use Amoura\Core\Realtime\WsFrame;
use PHPUnit\Framework\TestCase;

/** Codec de trames et poignée de main WebSocket RFC 6455 (Phase 1, Sprint +8). */
final class RealtimeFrameTest extends TestCase
{
    public function testHandshakeMatchesRfcExample(): void
    {
        // Vecteur de la RFC 6455 §1.3.
        $this->assertSame(
            's3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
            Handshake::acceptFor('dGhlIHNhbXBsZSBub25jZQ==')
        );
        $this->assertTrue(Handshake::verify('dGhlIHNhbXBsZSBub25jZQ==', 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='));
        $this->assertFalse(Handshake::verify('dGhlIHNhbXBsZSBub25jZQ==', 'mauvaise-cle='));
    }

    public function testClientKeyIs16BytesBase64(): void
    {
        $key = Handshake::clientKey();
        $this->assertSame(16, strlen((string) base64_decode($key, true)));
    }

    public function testMaskedRoundTrip(): void
    {
        $payload = json_encode(['type' => 'message', 'to' => 42, 'message' => ['t' => 12345.678]]);
        $frame = WsFrame::encode((string) $payload, WsFrame::OP_TEXT, true);

        // Client => trame masquée (le bit de masque doit être posé).
        $this->assertSame(0x80, ord($frame[1]) & 0x80);

        $decoded = WsFrame::decode($frame);
        $this->assertTrue($decoded['ok']);
        $this->assertTrue($decoded['fin']);
        $this->assertSame(WsFrame::OP_TEXT, $decoded['opcode']);
        $this->assertSame($payload, $decoded['payload']);
        $this->assertSame(strlen($frame), $decoded['consumed']);
    }

    public function testUnmaskedRoundTrip(): void
    {
        $decoded = WsFrame::decode(WsFrame::encode('serveur→client', WsFrame::OP_TEXT, false));
        $this->assertTrue($decoded['ok']);
        $this->assertSame('serveur→client', $decoded['payload']);
    }

    public function testMediumPayloadUses16BitLength(): void
    {
        $payload = str_repeat('x', 300);            // > 125 → longueur étendue 16 bits
        $decoded = WsFrame::decode(WsFrame::encode($payload, WsFrame::OP_TEXT, true));
        $this->assertSame(300, strlen($decoded['payload']));
    }

    public function testLargePayloadUses64BitLength(): void
    {
        $payload = str_repeat('y', 70000);          // > 65535 → longueur étendue 64 bits
        $decoded = WsFrame::decode(WsFrame::encode($payload, WsFrame::OP_TEXT, false));
        $this->assertTrue($decoded['ok']);
        $this->assertSame(70000, strlen($decoded['payload']));
    }

    public function testIncompleteBufferReturnsNotOk(): void
    {
        $frame = WsFrame::encode('bonjour', WsFrame::OP_TEXT, true);
        // Tampon tronqué → décodage impossible tant que tout n'est pas arrivé.
        $this->assertFalse(WsFrame::decode(substr($frame, 0, 3))['ok']);
        $this->assertFalse(WsFrame::decode('')['ok']);
    }

    public function testTwoFramesInBufferConsumeIndividually(): void
    {
        $buf = WsFrame::encode('un', WsFrame::OP_TEXT, false)
             . WsFrame::encode('deux', WsFrame::OP_TEXT, false);
        $first = WsFrame::decode($buf);
        $this->assertSame('un', $first['payload']);
        $second = WsFrame::decode(substr($buf, $first['consumed']));
        $this->assertSame('deux', $second['payload']);
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Security\Auth;
use Amoura\Core\Security\Csrf;
use Amoura\Core\Security\Nonce;
use Amoura\Core\Security\Sanitizer;
use Amoura\Core\Security\WsTicket;
use PHPUnit\Framework\TestCase;

final class SecurityTest extends TestCase
{
    public function testPasswordHashUsesArgon2id(): void
    {
        $hash = Auth::hash('S3cret!pass');
        $this->assertStringStartsWith('$argon2id$', $hash);
        $this->assertTrue(Auth::verify('S3cret!pass', $hash));
        $this->assertFalse(Auth::verify('mauvais', $hash));
    }

    public function testSanitizerEscapesHtml(): void
    {
        $this->assertSame('&lt;script&gt;alert(1)&lt;/script&gt;', Sanitizer::e('<script>alert(1)</script>'));
    }

    public function testRichTextStripsScriptsAndEventHandlers(): void
    {
        $dirty = '<p onclick="steal()">Bonjour</p><script>evil()</script><b>gras</b>';
        $clean = Sanitizer::richText($dirty);
        $this->assertStringNotContainsString('<script>', $clean);
        $this->assertStringNotContainsString('onclick', $clean);
        $this->assertStringContainsString('<b>gras</b>', $clean);
    }

    public function testRichTextNeutralisesDangerousHrefSchemes(): void
    {
        $clean = Sanitizer::richText('<a href="javascript:alert(1)">x</a>');
        $this->assertStringNotContainsString('javascript:', $clean);
    }

    public function testPhoneKeepsDigitsAndPlus(): void
    {
        $this->assertSame('+2250707000000', Sanitizer::phone(' +225 07 07 00 00 00 '));
    }

    public function testWsTicketRoundTrip(): void
    {
        $ticket = WsTicket::issue(4242);
        $this->assertSame(4242, WsTicket::verify($ticket));
    }

    public function testWsTicketRejectsTampering(): void
    {
        $ticket = WsTicket::issue(1);
        $this->assertNull(WsTicket::verify($ticket . 'x'));
        $this->assertNull(WsTicket::verify('nimportequoi'));
    }

    public function testCspNonceIsStableWithinRequestAndEmbeddable(): void
    {
        $nonce = Nonce::get();
        $this->assertNotEmpty($nonce);
        $this->assertSame($nonce, Nonce::get(), 'un seul nonce par requête');
        $this->assertStringContainsString('nonce="' . $nonce . '"', Nonce::attr());
        // Base64 valide (16 octets → 24 caractères avec padding).
        $this->assertNotFalse(base64_decode($nonce, true));
    }

    public function testCsrfTokenGenerationAndConstantTimeCompare(): void
    {
        $_SESSION = [];
        $token = Csrf::token();
        $this->assertNotEmpty($token);
        $this->assertSame($token, Csrf::token(), 'le jeton doit être stable dans la session');
        $this->assertTrue(Csrf::verify($token));
        $this->assertFalse(Csrf::verify('faux'));
        $this->assertFalse(Csrf::verify(''));
    }
}

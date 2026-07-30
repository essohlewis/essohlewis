<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\WhatsApp\WhatsAppService;
use PHPUnit\Framework\TestCase;

/**
 * Envoi WhatsApp (OTP d'inscription) : construction du corps de l'API Cloud et
 * normalisation des numéros. Logique pure, sans I/O réseau.
 */
final class WhatsAppTest extends TestCase
{
    public function testPayloadUsesApprovedTemplateWhenProvided(): void
    {
        $p = WhatsAppService::payload('2250700000000', '123456', 'amoura_verif', 'fr');
        $this->assertSame('template', $p['type']);
        $this->assertSame('amoura_verif', $p['template']['name']);
        $this->assertSame('fr', $p['template']['language']['code']);
        // Le code est le paramètre {{1}} du corps du modèle.
        $this->assertSame('123456', $p['template']['components'][0]['parameters'][0]['text']);
        $this->assertSame('2250700000000', $p['to']);
    }

    public function testPayloadFallsBackToTextWithoutTemplate(): void
    {
        $p = WhatsAppService::payload('2250700000000', '654321', '', 'fr');
        $this->assertSame('text', $p['type']);
        $this->assertStringContainsString('654321', $p['text']['body']);
    }

    public function testNormalizePhoneKeepsDigitsOnly(): void
    {
        $this->assertSame('2250700000000', WhatsAppService::normalizePhone('+225 07 00 00 00 00'));
        $this->assertSame('2250700000000', WhatsAppService::normalizePhone('225-07-00-00-00-00'));
        $this->assertSame('', WhatsAppService::normalizePhone('abc'));
    }

    public function testDriverDefaultsToLog(): void
    {
        // Sans configuration cloud, on reste en mode « log » (aucun envoi réel).
        $this->assertTrue(WhatsAppService::isLoggedOnly());
    }
}

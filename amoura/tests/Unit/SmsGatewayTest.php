<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Sms\LogSmsGateway;
use Amoura\Services\Sms\SmsManager;
use Amoura\Services\Sms\SmsGateway;
use PHPUnit\Framework\TestCase;

/** Passerelle SMS : pilote de log et sélection de driver (Phase 1, Sprint +7). */
final class SmsGatewayTest extends TestCase
{
    protected function tearDown(): void
    {
        SmsManager::setGateway(null);
        putenv('SMS_DRIVER');
        unset($_ENV['SMS_DRIVER']);
    }

    public function testLogGatewayWritesAndReportsOk(): void
    {
        $file = sys_get_temp_dir() . '/amoura-sms-' . uniqid() . '.log';
        $gw = new LogSmsGateway($file);

        $res = $gw->send('+2250700000000', 'Votre code Amoura : 123456');
        $this->assertTrue($res['ok']);
        $this->assertNotEmpty($res['ref']);
        $this->assertStringContainsString('123456', file_get_contents($file));
        $this->assertStringContainsString('+2250700000000', file_get_contents($file));
        @unlink($file);
    }

    public function testManagerDefaultsToLogDriver(): void
    {
        putenv('SMS_DRIVER=log');
        $_ENV['SMS_DRIVER'] = 'log';
        SmsManager::setGateway(null);
        $this->assertInstanceOf(LogSmsGateway::class, SmsManager::gateway());
    }

    public function testManagerHonorsInjectedGateway(): void
    {
        $fake = new class implements SmsGateway {
            public function send(string $to, string $message): array
            {
                return ['ok' => true, 'ref' => 'fake-1'];
            }
        };
        SmsManager::setGateway($fake);
        $this->assertSame('fake-1', SmsManager::gateway()->send('+225', 'x')['ref']);
    }
}

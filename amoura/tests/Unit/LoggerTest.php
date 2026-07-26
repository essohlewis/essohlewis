<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Logger;
use PHPUnit\Framework\TestCase;

final class LoggerTest extends TestCase
{
    private string $tmp;

    protected function setUp(): void
    {
        $this->tmp = sys_get_temp_dir() . '/amoura_test_' . uniqid() . '.log';
        Logger::setPath($this->tmp);
    }

    protected function tearDown(): void
    {
        @unlink($this->tmp);
    }

    public function testWritesStructuredJsonLine(): void
    {
        Logger::info('user.login', ['user_id' => 7]);
        $this->assertFileExists($this->tmp);

        $line = trim(file_get_contents($this->tmp));
        $entry = json_decode($line, true);

        $this->assertIsArray($entry);
        $this->assertSame('info', $entry['level']);
        $this->assertSame('user.login', $entry['message']);
        $this->assertSame(7, $entry['context']['user_id']);
        $this->assertArrayHasKey('ts', $entry);
    }

    public function testAppendsOnePerLine(): void
    {
        Logger::warn('a');
        Logger::error('b', ['x' => 1]);
        $lines = array_filter(explode("\n", file_get_contents($this->tmp)));
        $this->assertCount(2, $lines);
        foreach ($lines as $l) {
            $this->assertNotNull(json_decode($l), 'chaque ligne doit être un JSON valide');
        }
    }
}

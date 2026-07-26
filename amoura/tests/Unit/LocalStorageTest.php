<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Storage\LocalStorage;
use PHPUnit\Framework\TestCase;

/** Stockage local : écriture, URL, existence, suppression, anti-traversée (Sprint +6). */
final class LocalStorageTest extends TestCase
{
    private string $root;
    private LocalStorage $disk;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/amoura-storage-' . uniqid();
        mkdir($this->root, 0755, true);
        $this->disk = new LocalStorage($this->root, '/uploads');
    }

    protected function tearDown(): void
    {
        // Nettoyage récursif du répertoire temporaire.
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) {
            $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        }
        @rmdir($this->root);
    }

    public function testPutAndExists(): void
    {
        $rel = $this->disk->put('photos/a.txt', 'contenu');
        $this->assertSame('photos/a.txt', $rel);
        $this->assertTrue($this->disk->exists('photos/a.txt'));
        $this->assertSame('contenu', file_get_contents($this->root . '/photos/a.txt'));
    }

    public function testUrl(): void
    {
        $this->assertSame('/uploads/photos/a.txt', $this->disk->url('photos/a.txt'));
    }

    public function testDelete(): void
    {
        $this->disk->put('x.txt', 'y');
        $this->assertTrue($this->disk->delete('x.txt'));
        $this->assertFalse($this->disk->exists('x.txt'));
        $this->assertFalse($this->disk->delete('x.txt'), 'supprimer un absent renvoie false');
    }

    public function testPathTraversalIsNeutralized(): void
    {
        // Les « .. » sont retirés : l'écriture reste confinée à la racine.
        $this->disk->put('../evil.txt', 'malveillant');
        $this->assertFileDoesNotExist(dirname($this->root) . '/evil.txt');
    }
}

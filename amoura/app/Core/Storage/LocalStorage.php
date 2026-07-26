<?php
declare(strict_types=1);

namespace Amoura\Core\Storage;

/**
 * Stockage local (public/uploads) — pilote par défaut.
 */
final class LocalStorage implements Storage
{
    private string $root;
    private string $baseUrl;

    public function __construct(?string $root = null, string $baseUrl = '/uploads')
    {
        $this->root = rtrim($root ?? (dirname(__DIR__, 3) . '/public/uploads'), '/');
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    private function abs(string $relative): string
    {
        // Empêche la traversée de chemin.
        $relative = str_replace('..', '', ltrim($relative, '/'));
        return $this->root . '/' . $relative;
    }

    public function put(string $relativePath, string $contents): string
    {
        $abs = $this->abs($relativePath);
        @mkdir(dirname($abs), 0755, true);
        file_put_contents($abs, $contents);
        @chmod($abs, 0644);
        return ltrim($relativePath, '/');
    }

    public function putFile(string $relativePath, string $sourcePath): string
    {
        $abs = $this->abs($relativePath);
        @mkdir(dirname($abs), 0755, true);
        if (!@rename($sourcePath, $abs)) {
            copy($sourcePath, $abs);
        }
        @chmod($abs, 0644);
        return ltrim($relativePath, '/');
    }

    public function url(string $relativePath): string
    {
        return $this->baseUrl . '/' . ltrim($relativePath, '/');
    }

    public function delete(string $relativePath): bool
    {
        $abs = $this->abs($relativePath);
        return is_file($abs) ? @unlink($abs) : false;
    }

    public function exists(string $relativePath): bool
    {
        return is_file($this->abs($relativePath));
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Autoloader PSR-4 « maison » (aucun framework).
 * Mappe le préfixe de namespace « Amoura\ » vers le dossier app/.
 * Utilisé quand Composer n'est pas installé ; sinon vendor/autoload prend le relais.
 */
final class Autoloader
{
    /** @var array<string,string> préfixe de namespace => répertoire de base */
    private array $prefixes = [];

    public function register(): void
    {
        // Closure : la valeur de retour d'un autoloader est ignorée par PHP.
        spl_autoload_register(function (string $class): void {
            $this->load($class);
        });
    }

    public function addNamespace(string $prefix, string $baseDir): void
    {
        $prefix = trim($prefix, '\\') . '\\';
        $this->prefixes[$prefix] = rtrim($baseDir, '/') . '/';
    }

    public function load(string $class): bool
    {
        foreach ($this->prefixes as $prefix => $baseDir) {
            if (str_starts_with($class, $prefix)) {
                $relative = substr($class, strlen($prefix));
                $file = $baseDir . str_replace('\\', '/', $relative) . '.php';
                if (is_file($file)) {
                    require $file;
                    return true;
                }
            }
        }
        return false;
    }
}

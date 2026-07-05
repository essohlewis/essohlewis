<?php

declare(strict_types=1);

/**
 * Point d'entrée unique (front controller) de Transouscris.
 * Toutes les requêtes HTTP transitent par ce fichier.
 */

use Transouscris\Core\App;

$basePath = dirname(__DIR__);

// Autoload : Composer si présent, sinon autoloader PSR-4 de secours.
$composer = $basePath . '/vendor/autoload.php';
if (is_file($composer)) {
    require $composer;
} else {
    spl_autoload_register(static function (string $class) use ($basePath): void {
        $prefix = 'Transouscris\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }
        $relative = substr($class, strlen($prefix));
        $file = $basePath . '/app/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($file)) {
            require $file;
        }
    });
}

(new App($basePath))->run();

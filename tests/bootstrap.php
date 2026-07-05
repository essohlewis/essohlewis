<?php

declare(strict_types=1);

/**
 * Bootstrap PHPUnit : autoloader PSR-4 de secours (sans Composer) + config.
 */

$basePath = dirname(__DIR__);

$composer = $basePath . '/vendor/autoload.php';
if (is_file($composer)) {
    require $composer;
}

spl_autoload_register(static function (string $class) use ($basePath): void {
    foreach (['Transouscris\\Tests\\' => 'tests/', 'Transouscris\\' => 'app/'] as $prefix => $dir) {
        if (str_starts_with($class, $prefix)) {
            $file = $basePath . '/' . $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require $file;
                return;
            }
        }
    }
});

Transouscris\Core\Config::load($basePath . '/config');
require_once $basePath . '/app/helpers.php';

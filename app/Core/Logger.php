<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Journalisation fichier simple (append), niveaux PSR-like.
 * Les logs d'audit métier passent par Services\AuditLogger (table dédiée).
 */
final class Logger
{
    private static string $path = '';

    public static function configure(string $storageDir): void
    {
        self::$path = rtrim($storageDir, '/') . '/logs/app.log';
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('WARNING', $message, $context);
    }

    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }

    private static function write(string $level, string $message, array $context): void
    {
        if (self::$path === '') {
            return;
        }
        $line = sprintf(
            "[%s] %s: %s %s\n",
            date('c'),
            $level,
            $message,
            $context ? json_encode($context, JSON_UNESCAPED_UNICODE) : ''
        );
        @file_put_contents(self::$path, $line, FILE_APPEND | LOCK_EX);
    }
}

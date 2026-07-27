<?php
declare(strict_types=1);

namespace Amoura\Services;

use Amoura\Core\Env;

/**
 * Journalisation structurée (feuille de route — Phase 1).
 * Écrit des lignes JSON (une par événement) dans storage/logs/app.log —
 * format directement exploitable par une stack d'observabilité (ELK, Loki…).
 */
final class Logger
{
    public const DEBUG = 'debug';
    public const INFO  = 'info';
    public const WARN  = 'warning';
    public const ERROR = 'error';

    private static ?string $path = null;

    public static function log(string $level, string $message, array $context = []): void
    {
        $entry = [
            'ts'      => date('c'),
            'level'   => $level,
            'message' => $message,
            'context' => $context,
            'env'     => (string) Env::get('APP_ENV', 'local'),
        ];
        // Corrélation : rattache l'identifiant de requête si un contexte est actif.
        if (\Amoura\Core\Observability\RequestContext::started()) {
            $entry['request_id'] = \Amoura\Core\Observability\RequestContext::id();
        }
        $line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

        $file = self::path();
        // Écriture atomique avec verrou (sans échouer si le disque est saturé).
        @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
    }

    public static function debug(string $m, array $c = []): void { self::log(self::DEBUG, $m, $c); }
    public static function info(string $m, array $c = []): void  { self::log(self::INFO, $m, $c); }
    public static function warn(string $m, array $c = []): void  { self::log(self::WARN, $m, $c); }
    public static function error(string $m, array $c = []): void { self::log(self::ERROR, $m, $c); }

    /** Chemin du fichier de log (créé si besoin). */
    public static function path(): string
    {
        if (self::$path !== null) {
            return self::$path;
        }
        $dir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return self::$path = $dir . '/app.log';
    }

    /** Pour les tests : redirige la sortie vers un fichier temporaire. */
    public static function setPath(string $path): void
    {
        self::$path = $path;
    }
}

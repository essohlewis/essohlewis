<?php
declare(strict_types=1);

namespace Amoura\Core\Observability;

use Amoura\Core\Database;

/**
 * Registre de métriques minimal + exposition au format Prometheus (Phase 6).
 * Compteurs/jauges en mémoire pour le processus courant, plus un instantané des
 * jauges applicatives (fil d'attente, abonnements, présence) lu en base.
 */
final class Metrics
{
    /** @var array<string,array{type:string,help:string,values:array<string,float>}> */
    private static array $registry = [];

    private static function ensure(string $name, string $type, string $help): void
    {
        self::$registry[$name] ??= ['type' => $type, 'help' => $help, 'values' => []];
    }

    /** Sérialise des étiquettes en clé stable {a="1",b="2"}. */
    private static function key(array $labels): string
    {
        if (!$labels) {
            return '';
        }
        ksort($labels);
        $parts = [];
        foreach ($labels as $k => $v) {
            $parts[] = $k . '="' . str_replace(['\\', '"', "\n"], ['\\\\', '\\"', '\\n'], (string) $v) . '"';
        }
        return implode(',', $parts);
    }

    /** Incrémente un compteur. */
    public static function inc(string $name, array $labels = [], float $by = 1.0, string $help = ''): void
    {
        self::ensure($name, 'counter', $help);
        $k = self::key($labels);
        self::$registry[$name]['values'][$k] = (self::$registry[$name]['values'][$k] ?? 0.0) + $by;
    }

    /** Fixe la valeur d'une jauge. */
    public static function gauge(string $name, float $value, array $labels = [], string $help = ''): void
    {
        self::ensure($name, 'gauge', $help);
        self::$registry[$name]['values'][self::key($labels)] = $value;
    }

    /** Réinitialise le registre (tests). */
    public static function reset(): void
    {
        self::$registry = [];
    }

    /**
     * Renseigne les jauges applicatives depuis la base (best-effort : n'échoue
     * jamais l'endpoint de métriques si une requête casse).
     */
    public static function collectAppGauges(): void
    {
        try {
            $db = Database::read();
            $one = static fn(string $sql): float => (float) $db->query($sql)->fetchColumn();

            self::gauge('amoura_users_online', $one('SELECT COUNT(*) FROM users WHERE is_online = 1'),
                [], 'Utilisateurs actuellement en ligne');
            self::gauge('amoura_active_subscriptions', $one(
                'SELECT COUNT(*) FROM subscriptions WHERE status = "active"'), [], 'Abonnements actifs');
            self::gauge('amoura_outbox_pending', $one(
                "SELECT COUNT(*) FROM message_outbox WHERE status IN ('pending','sending')"),
                [], 'Messages e-mail/SMS en attente d\'envoi');
            self::gauge('amoura_outbox_failed', $one(
                "SELECT COUNT(*) FROM message_outbox WHERE status = 'failed'"),
                [], 'Messages en échec définitif');
            self::gauge('amoura_reports_open', $one(
                "SELECT COUNT(*) FROM reports WHERE status = 'open'"), [], 'Signalements ouverts');
            self::gauge('amoura_verifications_pending', $one(
                "SELECT COUNT(*) FROM verification_requests WHERE status = 'pending'"),
                [], 'Vérifications de profil en attente');
        } catch (\Throwable $e) {
            self::gauge('amoura_metrics_collect_error', 1, [], 'Échec de collecte des jauges applicatives');
        }
    }

    /** Rend le registre au format d'exposition Prometheus (text/plain). */
    public static function render(): string
    {
        $out = '';
        foreach (self::$registry as $name => $metric) {
            if ($metric['help'] !== '') {
                $out .= "# HELP {$name} {$metric['help']}\n";
            }
            $out .= "# TYPE {$name} {$metric['type']}\n";
            foreach ($metric['values'] as $labelKey => $value) {
                $labels = $labelKey !== '' ? '{' . $labelKey . '}' : '';
                $out .= $name . $labels . ' ' . self::fmt($value) . "\n";
            }
        }
        return $out;
    }

    /** Formate un nombre sans notation scientifique ni décimales superflues. */
    private static function fmt(float $v): string
    {
        if ($v === floor($v) && abs($v) < 1e15) {
            return (string) (int) $v;
        }
        return rtrim(rtrim(sprintf('%.6f', $v), '0'), '.');
    }
}

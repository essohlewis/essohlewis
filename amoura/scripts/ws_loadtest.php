<?php
declare(strict_types=1);

/**
 * Test de charge WebSocket / signaling (Phase 1, Sprint +8).
 *
 * Ouvre N connexions concurrentes au serveur temps réel, les authentifie avec
 * des tickets signés (forgés via WsTicket + APP_KEY — aucun compte requis),
 * mesure la latence de connexion (connexion → « ready ») puis la latence de
 * remise de messages entre paires d'utilisateurs. Compare au budget et rend un
 * code de sortie ≠ 0 en cas de dépassement.
 *
 *   php scripts/ws_loadtest.php --connections=50 --messages=5
 *
 * Options :
 *   --host=HOST         défaut : WS_HOST ou 127.0.0.1
 *   --port=PORT         défaut : WS_PORT ou 8090
 *   --connections=N     nombre de connexions (arrondi au pair, défaut : 20)
 *   --messages=R        messages envoyés par émetteur (défaut : 3)
 *   --timeout=S         durée max de la phase de remise (défaut : 20 s)
 *   --budget=fichier    budget JSON (défaut : perf-budget.json)
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Env;
use Amoura\Core\Benchmark\Budget;
use Amoura\Core\Benchmark\Metrics;
use Amoura\Core\Realtime\Handshake;
use Amoura\Core\Realtime\WsFrame;
use Amoura\Core\Security\WsTicket;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
@Env::load(__DIR__ . '/../.env');

function wsopt(string $name, ?string $default = null): ?string
{
    foreach ($GLOBALS['argv'] as $arg) {
        if (str_starts_with($arg, "--{$name}=")) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

$host = (string) wsopt('host', (string) Env::get('WS_HOST', '127.0.0.1'));
if ($host === '0.0.0.0') {
    $host = '127.0.0.1';
}
$port = (int) wsopt('port', (string) Env::get('WS_PORT', '8090'));
$conns = max(2, (int) wsopt('connections', '20'));
$conns -= $conns % 2;                        // pair (émetteur/récepteur)
$msgsPer = max(1, (int) wsopt('messages', '3'));
$deadline = microtime(true) + (float) wsopt('timeout', '20');
$budgetFile = (string) wsopt('budget', __DIR__ . '/../perf-budget.json');

$budget = is_file($budgetFile) ? (json_decode((string) file_get_contents($budgetFile), true) ?: []) : [];
$wsBudget = $budget['websocket']['thresholds'] ?? [];

echo "🏋️  Test de charge WebSocket → ws://{$host}:{$port}\n";
echo "    {$conns} connexions · {$msgsPer} message(s)/émetteur\n\n";

/** @var array<int,array<string,mixed>> état par connexion */
$peers = [];
$sockets = [];
$connectLatencies = [];
$deliveryLatencies = [];
$connectErrors = 0;
$baseUid = 900000;                           // plage d'IDs synthétiques

for ($i = 0; $i < $conns; $i++) {
    $uid = $baseUid + $i;
    $ticket = WsTicket::issue($uid);
    $errno = 0; $errstr = '';
    $sock = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, 5, STREAM_CLIENT_CONNECT);
    if ($sock === false) {
        $connectErrors++;
        continue;
    }
    stream_set_blocking($sock, false);
    $key = Handshake::clientKey();
    $path = '/?ticket=' . rawurlencode($ticket);
    @fwrite($sock, Handshake::request($host, $port, $path, $key));

    $id = (int) $sock;
    $sockets[$id] = $sock;
    $peers[$id] = [
        'uid' => $uid,
        'index' => $i,
        'key' => $key,
        'buffer' => '',
        'upgraded' => false,
        'ready' => false,
        'connect_start' => microtime(true),
        'sent' => 0,
        'received' => 0,
    ];
}

// Cible de remise : chaque émetteur pair (index 2k) écrit au récepteur impair (2k+1).
$uidByIndex = [];
foreach ($peers as $id => $p) {
    $uidByIndex[$p['index']] = $p['uid'];
}

$readyCount = 0;
$expectedDeliveries = ($conns / 2) * $msgsPer;

// ── Boucle d'événements ────────────────────────────────────────────────────
while (microtime(true) < $deadline && !empty($sockets)) {
    $read = $sockets;
    $write = null; $except = null;
    if (@stream_select($read, $write, $except, 0, 200000) === false) {
        break;
    }

    foreach ($read as $sock) {
        $id = (int) $sock;
        if (!isset($peers[$id])) {
            continue;
        }
        $chunk = @fread($sock, 65535);
        if ($chunk === '' || $chunk === false) {
            if (feof($sock)) {              // fermé par le serveur
                fclose($sock);
                unset($sockets[$id], $peers[$id]);
            }
            continue;
        }
        $peers[$id]['buffer'] .= $chunk;

        // 1) Poignée de main HTTP (jusqu'à \r\n\r\n).
        if (!$peers[$id]['upgraded']) {
            $pos = strpos($peers[$id]['buffer'], "\r\n\r\n");
            if ($pos === false) {
                continue;
            }
            $headers = substr($peers[$id]['buffer'], 0, $pos);
            $peers[$id]['buffer'] = substr($peers[$id]['buffer'], $pos + 4);
            if (!preg_match('/Sec-WebSocket-Accept:\s*(.+)\r?/i', $headers, $m)
                || !Handshake::verify($peers[$id]['key'], $m[1])) {
                $connectErrors++;
                fclose($sock);
                unset($sockets[$id], $peers[$id]);
                continue;
            }
            $peers[$id]['upgraded'] = true;
        }

        // 2) Trames WebSocket.
        while (true) {
            $frame = WsFrame::decode($peers[$id]['buffer']);
            if (!$frame['ok']) {
                break;
            }
            $peers[$id]['buffer'] = substr($peers[$id]['buffer'], $frame['consumed']);
            $op = $frame['opcode'];
            if ($op === WsFrame::OP_CLOSE) {
                fclose($sock);
                unset($sockets[$id], $peers[$id]);
                break;
            }
            if ($op !== WsFrame::OP_TEXT) {
                continue;
            }
            $data = json_decode((string) $frame['payload'], true);
            if (!is_array($data)) {
                continue;
            }
            if (($data['type'] ?? '') === 'ready' && !$peers[$id]['ready']) {
                $peers[$id]['ready'] = true;
                $readyCount++;
                $connectLatencies[] = (microtime(true) - $peers[$id]['connect_start']) * 1000;
            } elseif (($data['type'] ?? '') === 'message') {
                $sentAt = (float) ($data['message']['t'] ?? 0);
                if ($sentAt > 0) {
                    $deliveryLatencies[] = (microtime(true) - $sentAt) * 1000;
                }
            }
        }
    }

    // Phase de remise : dès qu'une paire est prête, l'émetteur envoie ses messages.
    foreach ($peers as $id => $p) {
        if (!$p['ready'] || $p['index'] % 2 !== 0 || $p['sent'] >= $msgsPer) {
            continue;
        }
        $partnerIndex = $p['index'] + 1;
        $partnerUid = $uidByIndex[$partnerIndex] ?? 0;
        if ($partnerUid === 0) {
            continue;
        }
        $payload = json_encode([
            'type' => 'message',
            'to' => $partnerUid,
            'conversation_id' => 0,
            'message' => ['t' => microtime(true)],
        ]);
        @fwrite($sockets[$id], WsFrame::encode((string) $payload, WsFrame::OP_TEXT, true));
        $peers[$id]['sent']++;
    }

    if (count($deliveryLatencies) >= $expectedDeliveries && $readyCount >= $conns) {
        break; // objectif atteint
    }
}

// Fermeture propre.
foreach ($sockets as $sock) {
    @fwrite($sock, WsFrame::encode('', WsFrame::OP_CLOSE, true));
    @fclose($sock);
}

// ── Rapport ────────────────────────────────────────────────────────────────
$connSummary = Metrics::summarize($connectLatencies);
$delSummary = Metrics::summarize($deliveryLatencies);
$delivered = count($deliveryLatencies);
$deliveryErrorRate = $expectedDeliveries > 0 ? max(0, ($expectedDeliveries - $delivered)) / $expectedDeliveries : 0.0;

printf("Connexions  : %d prêtes / %d  (%d erreur[s])\n", $readyCount, $conns, $connectErrors);
printf("  latence ms: p50 %.1f · p95 %.1f · p99 %.1f · max %.1f\n",
    $connSummary['p50'], $connSummary['p95'], $connSummary['p99'], $connSummary['max']);
printf("Remises     : %d / %d attendues  (%.2f %% perdues)\n",
    $delivered, $expectedDeliveries, $deliveryErrorRate * 100);
printf("  latence ms: p50 %.1f · p95 %.1f · p99 %.1f · max %.1f\n\n",
    $delSummary['p50'], $delSummary['p95'], $delSummary['p99'], $delSummary['max']);

// ── Verdict budget ─────────────────────────────────────────────────────────
$verdicts = [];
if (!empty($wsBudget['connect'])) {
    $v = Budget::evaluate($connSummary, 0.0, $wsBudget['connect']);
    echo "Budget connexion :\n";
    foreach ($v['checks'] as $c) {
        printf("  %s %-14s limite %-9.1f · mesuré %.1f\n", $c['pass'] ? '✅' : '❌', $c['metric'], $c['limit'], $c['actual']);
    }
    $verdicts[] = $v['pass'];
}
if (!empty($wsBudget['delivery'])) {
    $v = Budget::evaluate($delSummary, $deliveryErrorRate, $wsBudget['delivery']);
    echo "Budget remise :\n";
    foreach ($v['checks'] as $c) {
        printf("  %s %-14s limite %-9.3f · mesuré %.3f\n", $c['pass'] ? '✅' : '❌', $c['metric'], $c['limit'], $c['actual']);
    }
    $verdicts[] = $v['pass'];
}
$pass = !in_array(false, $verdicts, true);

if (empty($wsBudget)) {
    echo "ℹ️  Aucun budget WebSocket défini — rapport seul.\n";
    exit(0);
}
echo "\n" . ($pass ? "✅ Budget respecté.\n" : "❌ Budget dépassé.\n");
exit($pass ? 0 : 1);

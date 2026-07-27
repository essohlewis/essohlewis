<?php
declare(strict_types=1);

namespace Amoura\Services\Messaging;

use Amoura\Core\Env;
use Amoura\Models\Outbox;
use Amoura\Services\Logger;
use Amoura\Services\Mailer;
use Amoura\Services\Sms\SmsManager;

/**
 * Point d'entrée unique pour l'envoi de messages transactionnels (Phase 1, Sprint +7).
 *
 * Deux modes, pilotés par QUEUE_DRIVER :
 *   - "sync"  (défaut) : livraison immédiate dans la requête (aucune dépendance
 *              à un worker ; rétro-compatible avec le comportement historique).
 *   - "async"          : mise en file (table message_outbox) ; un worker draine
 *              la file et applique des relances à backoff. Découple la latence
 *              prestataire (SMTP/SMS) du temps de réponse HTTP.
 */
final class Dispatcher
{
    private static function async(): bool
    {
        return strtolower((string) Env::get('QUEUE_DRIVER', 'sync')) === 'async';
    }

    /** Envoie (ou enfile) un e-mail. Renvoie true si enfilé/livré avec succès. */
    public static function email(string $to, string $subject, string $htmlBody, array $meta = []): bool
    {
        if (self::async()) {
            (new Outbox())->enqueue('email', $to, $subject, $htmlBody, $meta);
            return true;
        }
        return Mailer::deliver($to, $subject, $htmlBody);
    }

    /** Envoie (ou enfile) un SMS. Renvoie true si enfilé/livré avec succès. */
    public static function sms(string $to, string $message, array $meta = []): bool
    {
        if (self::async()) {
            (new Outbox())->enqueue('sms', $to, null, $message, $meta);
            return true;
        }
        return SmsManager::gateway()->send($to, $message)['ok'] === true;
    }

    /**
     * Draine la file : réclame un lot, livre chaque message et met à jour son état.
     * Appelé par scripts/worker.php et par le cron.
     * @return array{processed:int, sent:int, failed:int}
     */
    public static function drain(int $limit = 50): array
    {
        $outbox = new Outbox();
        $batch = $outbox->claimBatch($limit);
        $sent = 0;
        $failed = 0;

        foreach ($batch as $msg) {
            $id = (int) $msg['id'];
            try {
                if ($msg['channel'] === 'email') {
                    $ok = Mailer::deliver((string) $msg['recipient'], (string) ($msg['subject'] ?? ''), (string) $msg['body']);
                    if ($ok) {
                        $outbox->markSent($id);
                        $sent++;
                    } else {
                        $outbox->markFailed($id, 'Échec de remise e-mail.');
                        $failed++;
                    }
                } else {
                    $result = SmsManager::gateway()->send((string) $msg['recipient'], (string) $msg['body']);
                    if ($result['ok'] === true) {
                        $outbox->markSent($id, $result['ref'] ?? null);
                        $sent++;
                    } else {
                        $outbox->markFailed($id, $result['error'] ?? 'Échec inconnu.');
                        $failed++;
                    }
                }
            } catch (\Throwable $e) {
                $outbox->markFailed($id, $e->getMessage());
                $failed++;
                Logger::error('outbox.delivery_failed', ['id' => $id, 'error' => $e->getMessage()]);
            }
        }

        return ['processed' => count($batch), 'sent' => $sent, 'failed' => $failed];
    }
}

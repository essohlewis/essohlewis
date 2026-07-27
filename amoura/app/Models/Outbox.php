<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * File d'attente d'envoi e-mail/SMS (Phase 1, Sprint +7).
 * Découple la requête HTTP de la latence prestataire ; un worker draine la file
 * et applique des relances à backoff exponentiel.
 */
final class Outbox extends Model
{
    protected string $table = 'message_outbox';

    /** Enfile un message et renvoie son id. */
    public function enqueue(string $channel, string $recipient, ?string $subject, string $body, array $meta = []): int
    {
        return $this->create([
            'channel' => $channel,
            'recipient' => $recipient,
            'subject' => $subject,
            'body' => $body,
            'meta' => $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
        ]);
    }

    /**
     * Réclame atomiquement un lot de messages « dus » et les passe en « sending ».
     * SKIP LOCKED (MySQL 8) permet à plusieurs workers de tourner sans collision.
     * @return array<int,array<string,mixed>> lignes réclamées
     */
    public function claimBatch(int $limit = 20): array
    {
        return $this->transaction(function ($db) use ($limit) {
            $sel = $db->prepare(
                "SELECT id FROM message_outbox
                 WHERE status IN ('pending','failed')
                   AND attempts < max_attempts
                   AND next_attempt_at <= NOW()
                 ORDER BY id ASC
                 LIMIT {$limit}
                 FOR UPDATE SKIP LOCKED"
            );
            $sel->execute();
            $ids = $sel->fetchAll(\PDO::FETCH_COLUMN);
            if (!$ids) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("UPDATE message_outbox SET status = 'sending' WHERE id IN ({$placeholders})")
               ->execute($ids);

            $rows = $db->prepare("SELECT * FROM message_outbox WHERE id IN ({$placeholders}) ORDER BY id ASC");
            $rows->execute($ids);
            return $rows->fetchAll();
        });
    }

    /** Marque un message comme envoyé. */
    public function markSent(int $id, ?string $providerRef = null): void
    {
        $this->run(
            "UPDATE message_outbox
             SET status = 'sent', sent_at = NOW(), provider_ref = ?, attempts = attempts + 1, last_error = NULL
             WHERE id = ?",
            [$providerRef, $id]
        );
    }

    /**
     * Marque un échec : incrémente les tentatives et replanifie avec backoff
     * exponentiel (60 s, 120 s, … plafonné à 1 h). Au-delà de max_attempts, le
     * message reste « failed » (lettre morte, plus repris).
     */
    public function markFailed(int $id, string $error): void
    {
        $this->run(
            "UPDATE message_outbox
             SET attempts = attempts + 1,
                 last_error = ?,
                 status = 'failed',
                 next_attempt_at = DATE_ADD(NOW(), INTERVAL LEAST(3600, 60 * POW(2, attempts)) SECOND)
             WHERE id = ?",
            [mb_substr($error, 0, 500), $id]
        );
    }

    /** Compte les messages par statut (supervision). */
    public function counts(): array
    {
        $rows = $this->run(
            "SELECT status, COUNT(*) AS n FROM message_outbox GROUP BY status"
        )->fetchAll();
        $out = ['pending' => 0, 'sending' => 0, 'sent' => 0, 'failed' => 0];
        foreach ($rows as $r) {
            $out[$r['status']] = (int) $r['n'];
        }
        return $out;
    }

    /** Purge les messages envoyés de plus de N jours (appelée par la maintenance). */
    public function purgeSent(int $days = 30): int
    {
        return $this->run(
            "DELETE FROM message_outbox WHERE status = 'sent' AND sent_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
            [$days]
        )->rowCount();
    }
}

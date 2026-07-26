<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Message extends Model
{
    protected string $table = 'messages';

    /**
     * Envoie un message et met à jour l'horodatage de la conversation, atomiquement.
     */
    public function send(int $conversationId, int $senderId, array $data): int
    {
        // Chiffrement au repos du texte (transparent).
        $body = $data['body'] ?? null;
        if (is_string($body) && $body !== '') {
            $body = \Amoura\Core\Security\Crypto::encrypt($body);
        }
        // Message éphémère : durée de vie optionnelle (secondes).
        $expiresAt = null;
        if (!empty($data['ttl']) && (int) $data['ttl'] > 0) {
            $expiresAt = date('Y-m-d H:i:s', time() + (int) $data['ttl']);
        }

        return $this->transaction(function ($db) use ($conversationId, $senderId, $data, $body, $expiresAt) {
            $stmt = $db->prepare(
                'INSERT INTO messages (conversation_id, reply_to_id, sender_id, type, body, media_path, media_meta, expires_at, delivered_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $stmt->execute([
                $conversationId,
                !empty($data['reply_to_id']) ? (int) $data['reply_to_id'] : null,
                $senderId,
                $data['type'] ?? 'text',
                $body,
                $data['media_path'] ?? null,
                isset($data['media_meta']) ? json_encode($data['media_meta']) : null,
                $expiresAt,
            ]);
            $id = (int) $db->lastInsertId();
            $db->prepare('UPDATE conversations SET last_message_at = NOW() WHERE id = ?')
               ->execute([$conversationId]);
            return $id;
        });
    }

    /** Historique paginé (« avant » l'id fourni, pour scroll infini). Déchiffre + exclut les éphémères expirés. */
    public function history(int $conversationId, int $beforeId = 0, int $limit = 40): array
    {
        $cursor = $beforeId > 0 ? 'AND m.id < ?' : '';
        $params = [$conversationId];
        if ($beforeId > 0) {
            $params[] = $beforeId;
        }
        $params[] = $limit;

        $rows = $this->run(
            "SELECT m.*,
                    (SELECT COUNT(*) FROM message_reactions r WHERE r.message_id = m.id) AS reaction_count,
                    rep.body AS reply_body, rep.sender_id AS reply_sender_id, rep.type AS reply_type
             FROM messages m
             LEFT JOIN messages rep ON rep.id = m.reply_to_id
             WHERE m.conversation_id = ? {$cursor} AND m.deleted_at IS NULL
               AND (m.expires_at IS NULL OR m.expires_at > NOW())
             ORDER BY m.id DESC LIMIT ?",
            $params
        )->fetchAll();

        foreach ($rows as &$r) {
            if (!empty($r['body'])) {
                $r['body'] = \Amoura\Core\Security\Crypto::decrypt((string) $r['body']);
            }
            if (!empty($r['reply_body'])) {
                $r['reply_body'] = \Amoura\Core\Security\Crypto::decrypt((string) $r['reply_body']);
            }
        }
        unset($r);
        return array_reverse($rows); // ordre chronologique pour l'affichage
    }

    public function markDelivered(int $messageId): void
    {
        $this->run('UPDATE messages SET delivered_at = COALESCE(delivered_at, NOW()) WHERE id = ?', [$messageId]);
    }

    /** Marque comme lus tous les messages reçus jusqu'à un id donné. */
    public function markReadUpTo(int $conversationId, int $readerId, int $lastId): void
    {
        $this->run(
            'UPDATE messages SET read_at = COALESCE(read_at, NOW())
             WHERE conversation_id = ? AND sender_id <> ? AND id <= ? AND read_at IS NULL',
            [$conversationId, $readerId, $lastId]
        );
    }

    public function react(int $messageId, int $userId, string $emoji): void
    {
        $this->run(
            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE emoji = VALUES(emoji)',
            [$messageId, $userId, $emoji]
        );
    }

    public function softDelete(int $messageId, int $senderId): bool
    {
        return $this->run(
            'UPDATE messages SET deleted_at = NOW(), body = NULL, media_path = NULL
             WHERE id = ? AND sender_id = ?',
            [$messageId, $senderId]
        )->rowCount() > 0;
    }
}

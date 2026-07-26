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
        return $this->transaction(function ($db) use ($conversationId, $senderId, $data) {
            $stmt = $db->prepare(
                'INSERT INTO messages (conversation_id, sender_id, type, body, media_path, media_meta, delivered_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())'
            );
            $stmt->execute([
                $conversationId,
                $senderId,
                $data['type'] ?? 'text',
                $data['body'] ?? null,
                $data['media_path'] ?? null,
                isset($data['media_meta']) ? json_encode($data['media_meta']) : null,
            ]);
            $id = (int) $db->lastInsertId();
            $db->prepare('UPDATE conversations SET last_message_at = NOW() WHERE id = ?')
               ->execute([$conversationId]);
            return $id;
        });
    }

    /** Historique paginé (« avant » l'id fourni, pour scroll infini). */
    public function history(int $conversationId, int $beforeId = 0, int $limit = 40): array
    {
        if ($beforeId > 0) {
            $rows = $this->run(
                'SELECT m.*, (SELECT COUNT(*) FROM message_reactions r WHERE r.message_id = m.id) AS reaction_count
                 FROM messages m
                 WHERE m.conversation_id = ? AND m.id < ? AND m.deleted_at IS NULL
                 ORDER BY m.id DESC LIMIT ?',
                [$conversationId, $beforeId, $limit]
            )->fetchAll();
        } else {
            $rows = $this->run(
                'SELECT m.*, (SELECT COUNT(*) FROM message_reactions r WHERE r.message_id = m.id) AS reaction_count
                 FROM messages m
                 WHERE m.conversation_id = ? AND m.deleted_at IS NULL
                 ORDER BY m.id DESC LIMIT ?',
                [$conversationId, $limit]
            )->fetchAll();
        }
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

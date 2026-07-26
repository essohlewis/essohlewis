<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Conversation extends Model
{
    protected string $table = 'conversations';

    /** Vérifie que l'utilisateur est bien membre de la conversation. */
    public function isMember(int $conversationId, int $userId): bool
    {
        return (bool) $this->run(
            'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [$conversationId, $userId]
        )->fetchColumn();
    }

    public function otherMember(int $conversationId, int $userId): ?int
    {
        $id = $this->run(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1',
            [$conversationId, $userId]
        )->fetchColumn();
        return $id !== false ? (int) $id : null;
    }

    public function touch(int $conversationId): void
    {
        $this->run('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [$conversationId]);
    }

    public function markRead(int $conversationId, int $userId, int $lastMessageId): void
    {
        $this->run(
            'UPDATE conversation_members SET last_read_message_id = GREATEST(COALESCE(last_read_message_id,0), ?)
             WHERE conversation_id = ? AND user_id = ?',
            [$lastMessageId, $conversationId, $userId]
        );
    }
}

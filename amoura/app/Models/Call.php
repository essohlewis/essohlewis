<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Journalise les appels WebRTC (le média est P2P ; ici on garde les métadonnées). */
final class Call extends Model
{
    protected string $table = 'calls';

    public function start(int $callerId, int $calleeId, string $kind, ?int $conversationId): int
    {
        return $this->create([
            'caller_id' => $callerId,
            'callee_id' => $calleeId,
            'kind' => in_array($kind, ['audio', 'video'], true) ? $kind : 'audio',
            'conversation_id' => $conversationId,
            'status' => 'ringing',
        ]);
    }

    public function setStatus(int $callId, string $status): void
    {
        $extra = '';
        if ($status === 'ongoing') {
            $extra = ', started_at = NOW()';
        } elseif (in_array($status, ['ended', 'missed', 'declined', 'failed'], true)) {
            $extra = ', ended_at = NOW(), duration_sec = TIMESTAMPDIFF(SECOND, COALESCE(started_at, created_at), NOW())';
        }
        $this->run("UPDATE calls SET status = ?{$extra} WHERE id = ?", [$status, $callId]);
    }

    public function recent(int $userId, int $limit = 30): array
    {
        return $this->run(
            'SELECT c.*, caller.display_name AS caller_name, callee.display_name AS callee_name
             FROM calls c
             JOIN users caller ON caller.id = c.caller_id
             JOIN users callee ON callee.id = c.callee_id
             WHERE c.caller_id = ? OR c.callee_id = ?
             ORDER BY c.created_at DESC LIMIT ?',
            [$userId, $userId, $limit]
        )->fetchAll();
    }
}

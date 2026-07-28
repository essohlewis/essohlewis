<?php
declare(strict_types=1);

namespace Amoura\Services\Messaging;

use Amoura\Core\Security\Sanitizer;
use Amoura\Models\Conversation;
use Amoura\Models\Matching;
use Amoura\Models\Message;
use Amoura\Models\Notification;

/**
 * Logique métier de la messagerie, partagée entre l'application web
 * (MessageController) et l'API mobile (Api\MessageController) : contrôle
 * d'appartenance à la conversation, envoi de texte chiffré au repos, accusés
 * de lecture et notification du destinataire. Un seul endroit fait foi.
 */
final class MessagingService
{
    public const MAX_BODY = 4000;
    public const MAX_TTL = 86400;

    /**
     * Envoie un message texte. Vérifie l'appartenance, assainit le corps,
     * persiste (chiffré) et notifie le destinataire.
     *
     * @return array{ok:bool,status:int,error:?string,message:?array<string,mixed>}
     */
    public function sendText(int $uid, int $conversationId, string $rawBody, int $replyTo = 0, int $ttl = 0): array
    {
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, $uid)) {
            return self::fail(403, 'Conversation inaccessible.');
        }
        $body = Sanitizer::text($rawBody, self::MAX_BODY);
        if ($body === '') {
            return self::fail(422, 'Message vide.');
        }
        $ttl = $ttl > 0 ? min($ttl, self::MAX_TTL) : 0;

        $messageId = (new Message())->send($conversationId, $uid, [
            'type'        => 'text',
            'body'        => $body,
            'reply_to_id' => $replyTo ?: null,
            'ttl'         => $ttl,
        ]);
        $this->notifyRecipient($conv, $conversationId, $uid);

        return [
            'ok'      => true,
            'status'  => 201,
            'error'   => null,
            'message' => [
                'id'              => $messageId,
                'conversation_id' => $conversationId,
                'sender_id'       => $uid,
                'type'            => 'text',
                'body'            => $body,
                'reply_to_id'     => $replyTo ?: null,
                'expires_at'      => $ttl > 0 ? date('Y-m-d H:i:s', time() + $ttl) : null,
                'created_at'      => date('Y-m-d H:i:s'),
            ],
        ];
    }

    /**
     * Historique déchiffré d'une conversation (après contrôle d'appartenance).
     *
     * @return array{ok:bool,status:int,error:?string,messages:array<int,array<string,mixed>>}
     */
    public function history(int $uid, int $conversationId, int $before = 0, int $limit = 40): array
    {
        if (!(new Conversation())->isMember($conversationId, $uid)) {
            return ['ok' => false, 'status' => 403, 'error' => 'Conversation inaccessible.', 'messages' => []];
        }
        $rows = (new Message())->history($conversationId, max(0, $before), max(1, min(100, $limit)));
        return ['ok' => true, 'status' => 200, 'error' => null, 'messages' => $rows];
    }

    /**
     * Marque comme lus les messages reçus jusqu'à un id donné.
     *
     * @return array{ok:bool,status:int}
     */
    public function markRead(int $uid, int $conversationId, int $lastMessageId): array
    {
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, $uid)) {
            return ['ok' => false, 'status' => 403];
        }
        $conv->markRead($conversationId, $uid, $lastMessageId);
        (new Message())->markReadUpTo($conversationId, $uid, $lastMessageId);
        return ['ok' => true, 'status' => 200];
    }

    /**
     * Liste des conversations (matches) de l'utilisateur avec aperçu.
     *
     * @return array<int,array<string,mixed>>
     */
    public function conversations(int $uid): array
    {
        $rows = (new Matching())->forUser($uid);
        return array_values(array_filter(array_map(static function (array $m): ?array {
            if ($m['conversation_id'] === null) {
                return null; // match sans conversation ouverte
            }
            $preview = $m['last_message'] !== null
                ? \Amoura\Core\Security\Crypto::decrypt((string) $m['last_message'])
                : null;
            return [
                'conversation_id' => (int) $m['conversation_id'],
                'user_id'         => (int) $m['user_id'],
                'display_name'    => $m['display_name'],
                'avatar'          => avatar_url($m['avatar_path'] ?? null),
                'is_online'       => (bool) $m['is_online'],
                'is_verified'     => (bool) $m['is_verified'],
                'unread'          => (int) $m['unread'],
                'last_message'    => $preview !== null ? mb_substr($preview, 0, 140) : null,
                'last_message_at' => $m['last_message_at'],
            ];
        }, $rows)));
    }

    /** Crée une notification pour le destinataire (le WS la pousse en direct). */
    private function notifyRecipient(Conversation $conv, int $conversationId, int $senderId): void
    {
        $otherId = $conv->otherMember($conversationId, $senderId);
        if ($otherId !== null) {
            (new Notification())->push(
                $otherId,
                'message',
                $senderId,
                ['conversation_id' => $conversationId],
                'conversation',
                $conversationId
            );
        }
    }

    /** @return array{ok:bool,status:int,error:string,message:null} */
    private static function fail(int $status, string $error): array
    {
        return ['ok' => false, 'status' => $status, 'error' => $error, 'message' => null];
    }
}

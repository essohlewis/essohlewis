<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Services\Messaging\MessagingService;

/**
 * Messagerie pour les clients mobiles (jeton porteur). Réutilise
 * MessagingService (contrôle d'appartenance, chiffrement au repos, notification)
 * et projette des messages JSON stables. Les médias (voix/image) restent servis
 * par les endpoints web multipart ; ici : conversations, historique, envoi texte
 * et accusés de lecture.
 */
final class MessageController extends ApiController
{
    /** Liste des conversations avec aperçu du dernier message déchiffré. */
    public function conversations(Request $request): void
    {
        $this->requireAbility('messages:read');
        $list = (new MessagingService())->conversations((int) $this->user()['id']);
        Response::ok(['conversations' => $list]);
    }

    /** Historique déchiffré d'une conversation (pagination « before »). */
    public function history(Request $request, array $params): void
    {
        $this->requireAbility('messages:read');
        $limit = max(1, min(100, (int) $request->query('limit', '40')));
        $res = (new MessagingService())->history(
            (int) $this->user()['id'],
            (int) $params['id'],
            (int) $request->query('before', '0'),
            $limit
        );
        if (!$res['ok']) {
            Response::error((string) $res['error'], $res['status']);
        }
        Response::ok(['messages' => array_map([$this, 'projectMessage'], $res['messages'])]);
    }

    /** Envoi d'un message texte (chiffré au repos). */
    public function send(Request $request, array $params): void
    {
        $this->requireAbility('messages:write');
        $res = (new MessagingService())->sendText(
            (int) $this->user()['id'],
            (int) $params['id'],
            (string) $request->input('body'),
            (int) $request->input('reply_to_id', 0),
            (int) $request->input('ttl', 0)
        );
        if (!$res['ok']) {
            Response::error((string) $res['error'], $res['status']);
        }
        Response::json(['ok' => true, 'message' => $res['message']], 201);
    }

    /** Accusé de lecture jusqu'à un identifiant de message. */
    public function read(Request $request, array $params): void
    {
        $this->requireAbility('messages:write');
        $res = (new MessagingService())->markRead(
            (int) $this->user()['id'],
            (int) $params['id'],
            (int) $request->input('last_message_id', 0)
        );
        if (!$res['ok']) {
            Response::error('Conversation inaccessible.', $res['status']);
        }
        Response::ok(['read' => true]);
    }

    /**
     * Projection publique et stable d'un message pour l'API.
     *
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    private function projectMessage(array $r): array
    {
        $media = $r['media_path'] ?? null;
        if (is_string($media) && $media !== '' && !str_starts_with($media, '/')) {
            $media = '/uploads/' . $media;
        }
        $meta = $r['media_meta'] ?? null;
        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: null;
        }
        return [
            'id'              => (int) $r['id'],
            'conversation_id' => (int) $r['conversation_id'],
            'sender_id'       => (int) $r['sender_id'],
            'type'            => $r['type'],
            'body'            => $r['body'] ?? null,
            'media_path'      => $media,
            'media_meta'      => $meta,
            'reply_to_id'     => isset($r['reply_to_id']) ? (int) $r['reply_to_id'] : null,
            'reply_body'      => $r['reply_body'] ?? null,
            'reactions'       => (int) ($r['reaction_count'] ?? 0),
            'delivered_at'    => $r['delivered_at'] ?? null,
            'read_at'         => $r['read_at'] ?? null,
            'expires_at'      => $r['expires_at'] ?? null,
            'created_at'      => $r['created_at'] ?? null,
        ];
    }
}

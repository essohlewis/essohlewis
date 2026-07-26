<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\Conversation;
use Amoura\Models\Matching;
use Amoura\Models\Message;
use Amoura\Models\Notification;
use Amoura\Models\User;
use Amoura\Services\Uploader;

/**
 * Messagerie. La persistance est faite ici (REST) ; la diffusion temps réel
 * (indicateur de frappe, présence, notification) transite par le serveur
 * WebSocket. La messagerie n'est débloquée qu'entre profils matchés.
 */
final class MessageController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $matches = (new Matching())->forUser((int) $user['id']);
        foreach ($matches as &$m) {
            $m['avatar'] = avatar_url($m['avatar_path'] ?? null);
        }
        $this->view('messages/index', ['matches' => $matches, 'activeConversation' => null]);
    }

    public function thread(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, (int) $user['id'])) {
            http_response_code(403);
            $this->view('errors/error', ['code' => 403, 'message' => 'Conversation inaccessible'], null);
            return;
        }
        $otherId = $conv->otherMember($conversationId, (int) $user['id']);
        $matches = (new Matching())->forUser((int) $user['id']);
        foreach ($matches as &$m) {
            $m['avatar'] = avatar_url($m['avatar_path'] ?? null);
        }
        $this->view('messages/thread', [
            'matches' => $matches,
            'conversationId' => $conversationId,
            'other' => $otherId ? (new User())->fullProfile($otherId) : null,
            'messages' => (new Message())->history($conversationId),
        ]);
    }

    public function history(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        if (!(new Conversation())->isMember($conversationId, (int) $user['id'])) {
            $this->json(['ok' => false, 'error' => 'Interdit'], 403);
        }
        $before = (int) $request->query('before', 0);
        $messages = (new Message())->history($conversationId, $before);
        $this->json(['ok' => true, 'messages' => $messages]);
    }

    public function send(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, (int) $user['id'])) {
            $this->json(['ok' => false, 'error' => 'Interdit'], 403);
        }
        $body = Sanitizer::text((string) $request->input('body'), 4000);
        if ($body === '') {
            $this->json(['ok' => false, 'error' => 'Message vide.'], 422);
        }

        $messageId = (new Message())->send($conversationId, (int) $user['id'], ['type' => 'text', 'body' => $body]);
        $this->notifyRecipient($conv, $conversationId, (int) $user['id']);

        $this->json([
            'ok' => true,
            'message' => [
                'id' => $messageId,
                'sender_id' => (int) $user['id'],
                'type' => 'text',
                'body' => $body,
                'created_at' => date('Y-m-d H:i:s'),
            ],
        ]);
    }

    public function sendVoice(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, (int) $user['id'])) {
            $this->json(['ok' => false, 'error' => 'Interdit'], 403);
        }
        $file = $request->file('audio');
        if (!$file) {
            $this->json(['ok' => false, 'error' => 'Aucun audio.'], 422);
        }
        $up = Uploader::audio($file);
        if (!$up['ok']) {
            $this->json(['ok' => false, 'error' => $up['error']], 422);
        }
        // Métadonnées : durée + waveform (échantillons d'amplitude) calculées côté client.
        $meta = json_decode((string) $request->input('meta'), true) ?: [];
        $meta = [
            'duration' => (float) ($meta['duration'] ?? 0),
            'waveform' => array_slice(array_map('floatval', $meta['waveform'] ?? []), 0, 60),
        ];
        $messageId = (new Message())->send($conversationId, (int) $user['id'], [
            'type' => 'voice', 'media_path' => $up['path'], 'media_meta' => $meta,
        ]);
        $this->notifyRecipient($conv, $conversationId, (int) $user['id']);
        $this->json(['ok' => true, 'message' => [
            'id' => $messageId, 'sender_id' => (int) $user['id'], 'type' => 'voice',
            'media_path' => '/uploads/' . $up['path'], 'media_meta' => $meta, 'created_at' => date('Y-m-d H:i:s'),
        ]]);
    }

    public function sendImage(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, (int) $user['id'])) {
            $this->json(['ok' => false, 'error' => 'Interdit'], 403);
        }
        $file = $request->file('image');
        if (!$file) {
            $this->json(['ok' => false, 'error' => 'Aucune image.'], 422);
        }
        $up = Uploader::image($file, 'chat');
        if (!$up['ok']) {
            $this->json(['ok' => false, 'error' => $up['error']], 422);
        }
        $meta = ['width' => $up['width'], 'height' => $up['height'], 'thumb' => $up['thumb'] ? '/uploads/' . $up['thumb'] : null];
        $messageId = (new Message())->send($conversationId, (int) $user['id'], [
            'type' => 'image', 'media_path' => $up['path'], 'media_meta' => $meta,
        ]);
        $this->notifyRecipient($conv, $conversationId, (int) $user['id']);
        $this->json(['ok' => true, 'message' => [
            'id' => $messageId, 'sender_id' => (int) $user['id'], 'type' => 'image',
            'media_path' => '/uploads/' . $up['path'], 'media_meta' => $meta, 'created_at' => date('Y-m-d H:i:s'),
        ]]);
    }

    public function markRead(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $conversationId = (int) $params['id'];
        $lastId = (int) $request->input('last_message_id', 0);
        $conv = new Conversation();
        if (!$conv->isMember($conversationId, (int) $user['id'])) {
            $this->json(['ok' => false], 403);
        }
        $conv->markRead($conversationId, (int) $user['id'], $lastId);
        (new Message())->markReadUpTo($conversationId, (int) $user['id'], $lastId);
        $this->json(['ok' => true]);
    }

    public function react(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $emoji = Sanitizer::text((string) $request->input('emoji'), 16);
        (new Message())->react((int) $params['id'], (int) $user['id'], $emoji);
        $this->json(['ok' => true]);
    }

    public function delete(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $ok = (new Message())->softDelete((int) $params['id'], (int) $user['id']);
        $this->json(['ok' => $ok]);
    }

    /** Crée une notification pour le destinataire (le WS la poussera en direct). */
    private function notifyRecipient(Conversation $conv, int $conversationId, int $senderId): void
    {
        $otherId = $conv->otherMember($conversationId, $senderId);
        if ($otherId) {
            (new Notification())->push($otherId, 'message', $senderId, ['conversation_id' => $conversationId], 'conversation', $conversationId);
        }
    }
}

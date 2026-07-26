<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Models\Call;
use Amoura\Models\Conversation;
use Amoura\Models\Matching;
use Amoura\Models\Notification;

/**
 * Appels audio/vidéo. Le média circule en pair-à-pair (WebRTC) ; le serveur
 * ne gère que le signaling (via WebSocket) et les métadonnées (durée, statut).
 */
final class CallController extends Controller
{
    public function history(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('messages/calls', ['calls' => (new Call())->recent((int) $user['id'])]);
    }

    /** Fournit la configuration ICE (STUN/TURN) au client WebRTC. */
    public function iceConfig(Request $request): void
    {
        $this->requireAuth($request);
        $iceServers = [];
        foreach (explode(',', (string) Env::get('STUN_URLS', 'stun:stun.l.google.com:19302')) as $stun) {
            $stun = trim($stun);
            if ($stun !== '') {
                $iceServers[] = ['urls' => $stun];
            }
        }
        $turnUrl = (string) Env::get('TURN_URL', '');
        if ($turnUrl !== '') {
            $iceServers[] = [
                'urls' => $turnUrl,
                'username' => (string) Env::get('TURN_USER', ''),
                'credential' => (string) Env::get('TURN_PASS', ''),
            ];
        }
        $this->json(['ok' => true, 'iceServers' => $iceServers]);
    }

    public function start(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $calleeId = (int) $request->input('callee_id');
        $kind = (string) $request->input('kind', 'audio');

        // Sécurité : n'autoriser les appels qu'entre profils matchés.
        if (!(new Matching())->areMatched($uid, $calleeId)) {
            $this->json(['ok' => false, 'error' => 'Vous devez être matchés pour vous appeler.'], 403);
        }

        $conversationId = (int) $request->input('conversation_id', 0) ?: null;
        $callId = (new Call())->start($uid, $calleeId, $kind, $conversationId);

        // Notifie l'appelé (le WS relaiera l'offre WebRTC).
        (new Notification())->push($calleeId, 'call', $uid, [
            'call_id' => $callId, 'kind' => $kind, 'conversation_id' => $conversationId,
        ], 'call', $callId);

        $this->json(['ok' => true, 'call_id' => $callId]);
    }

    public function updateStatus(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $callId = (int) $params['id'];
        $status = (string) $request->input('status');
        $allowed = ['ongoing', 'ended', 'missed', 'declined', 'failed'];
        if (!in_array($status, $allowed, true)) {
            $this->json(['ok' => false, 'error' => 'Statut invalide.'], 422);
        }
        $call = (new Call())->find($callId);
        if (!$call || ((int) $call['caller_id'] !== (int) $user['id'] && (int) $call['callee_id'] !== (int) $user['id'])) {
            $this->json(['ok' => false, 'error' => 'Interdit'], 403);
        }
        (new Call())->setStatus($callId, $status);
        $this->json(['ok' => true]);
    }
}

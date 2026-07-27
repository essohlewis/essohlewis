<?php
declare(strict_types=1);

namespace Amoura\Websocket;

use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;
use Amoura\Core\Security\WsTicket;
use Amoura\Models\User;

/**
 * Serveur temps réel Amoura (Ratchet / WebSocket).
 *
 * Responsabilités :
 *  - Présence en ligne / hors-ligne.
 *  - Relais du chat (nouveau message, indicateur de frappe, accusés de lecture).
 *  - Diffusion des notifications (match, like, commentaire, appel entrant).
 *  - Signaling WebRTC (offer / answer / ICE candidates) pour les appels P2P.
 *
 * Authentification : chaque connexion fournit un ticket signé (?ticket=...)
 * émis côté HTTP après vérification de la session.
 */
final class ChatServer implements MessageComponentInterface
{
    /** @var \SplObjectStorage<ConnectionInterface,int> connexion => userId */
    private \SplObjectStorage $clients;
    /** @var array<int,array<int,ConnectionInterface>> userId => [resourceId => conn] (multi-onglets) */
    private array $userConnections = [];

    private ?\Amoura\Websocket\Bus\Bus $bus;

    public function __construct(?\Amoura\Websocket\Bus\Bus $bus = null)
    {
        $this->clients = new \SplObjectStorage();
        // Le bus relaie les messages entre instances (clustering). Par défaut : local.
        $this->bus = $bus ?? new \Amoura\Websocket\Bus\LocalBus();
        $this->bus->onDeliver([$this, 'deliverLocal']);
    }

    /** Distribue un message aux connexions locales de l'utilisateur (appelé par le bus). */
    public function deliverLocal(int $userId, array $payload): void
    {
        if ($userId <= 0 || empty($this->userConnections[$userId])) {
            return;
        }
        $json = json_encode($payload);
        foreach ($this->userConnections[$userId] as $conn) {
            $conn->send($json);
        }
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        // Extrait et vérifie le ticket depuis la query string.
        // getUri() renvoie un objet PSR-7 UriInterface : on lit sa query via
        // getQuery() (passer l'objet à parse_url() lèverait une TypeError).
        $query = [];
        parse_str($conn->httpRequest->getUri()->getQuery(), $query);
        $userId = WsTicket::verify($query['ticket'] ?? '');

        if ($userId === null) {
            $conn->send(json_encode(['type' => 'error', 'error' => 'unauthorized']));
            $conn->close();
            return;
        }

        $conn->userId = $userId;
        $this->clients->attach($conn, $userId);
        $this->userConnections[$userId][$conn->resourceId] = $conn;

        // Première connexion de l'utilisateur => passe en ligne.
        if (count($this->userConnections[$userId]) === 1) {
            (new User())->setOnline($userId, true);
            $this->broadcastPresence($userId, true);
        }
        $conn->send(json_encode(['type' => 'ready', 'user_id' => $userId]));
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        $data = json_decode((string) $msg, true);
        if (!is_array($data) || !isset($data['type'])) {
            return;
        }
        $userId = $from->userId ?? null;
        if ($userId === null) {
            return;
        }

        switch ($data['type']) {
            // ── Chat ────────────────────────────────────────────────
            case 'message':
                // Le message est déjà persisté via REST ; ici on le relaie en direct.
                $this->bus->publish((int) ($data['to'] ?? 0), [
                    'type' => 'message',
                    'conversation_id' => $data['conversation_id'] ?? null,
                    'message' => $data['message'] ?? null,
                    'from' => $userId,
                ]);
                break;

            case 'typing':
                $this->bus->publish((int) ($data['to'] ?? 0), [
                    'type' => 'typing',
                    'conversation_id' => $data['conversation_id'] ?? null,
                    'from' => $userId,
                    'state' => $data['state'] ?? 'start', // start | stop
                ]);
                break;

            case 'read':
                $this->bus->publish((int) ($data['to'] ?? 0), [
                    'type' => 'read',
                    'conversation_id' => $data['conversation_id'] ?? null,
                    'last_message_id' => $data['last_message_id'] ?? null,
                    'from' => $userId,
                ]);
                break;

            // ── Notifications ───────────────────────────────────────
            case 'notify':
                $this->bus->publish((int) ($data['to'] ?? 0), [
                    'type' => 'notification',
                    'payload' => $data['payload'] ?? [],
                    'from' => $userId,
                ]);
                break;

            // ── Signaling WebRTC (appels audio/vidéo) ───────────────
            case 'call:offer':
            case 'call:answer':
            case 'call:ice':
            case 'call:hangup':
            case 'call:reject':
                // Relais transparent des messages de signaling au pair désigné.
                $this->bus->publish((int) ($data['to'] ?? 0), [
                    'type' => $data['type'],
                    'call_id' => $data['call_id'] ?? null,
                    'kind' => $data['kind'] ?? null,
                    'sdp' => $data['sdp'] ?? null,
                    'candidate' => $data['candidate'] ?? null,
                    'from' => $userId,
                ]);
                break;
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $userId = $conn->userId ?? null;
        $this->clients->detach($conn);
        if ($userId !== null && isset($this->userConnections[$userId])) {
            unset($this->userConnections[$userId][$conn->resourceId]);
            if (empty($this->userConnections[$userId])) {
                unset($this->userConnections[$userId]);
                (new User())->setOnline($userId, false);
                $this->broadcastPresence($userId, false);
            }
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        $conn->close();
    }

    /** Notifie les correspondants du changement de présence (local au nœud). */
    private function broadcastPresence(int $userId, bool $online): void
    {
        $payload = json_encode(['type' => 'presence', 'user_id' => $userId, 'online' => $online]);
        foreach ($this->clients as $conn) {
            if (($conn->userId ?? null) !== $userId) {
                $conn->send($payload);
            }
        }
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Websocket\Bus;

use React\EventLoop\LoopInterface;

/**
 * Bus de diffusion temps réel (Sprint +3 — clustering WebSocket).
 *
 * Abstraction permettant à plusieurs instances du serveur WebSocket de se
 * relayer les messages : chaque nœud publie sur le bus et distribue localement
 * ce qu'il reçoit aux connexions qu'il héberge.
 */
interface Bus
{
    /**
     * Enregistre le distributeur local : fn(int $userId, array $payload): void
     * appelé quand un message destiné à $userId doit être remis aux sockets locaux.
     */
    public function onDeliver(callable $deliverer): void;

    /** Publie un message destiné à un utilisateur (potentiellement sur un autre nœud). */
    public function publish(int $userId, array $payload): void;

    /** Démarre le bus dans la boucle d'événements (abonnement, connexions…). */
    public function start(LoopInterface $loop): void;
}

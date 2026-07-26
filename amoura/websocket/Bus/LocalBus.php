<?php
declare(strict_types=1);

namespace Amoura\Websocket\Bus;

use React\EventLoop\LoopInterface;

/**
 * Bus mono-instance : la publication distribue immédiatement en local.
 * Pilote par défaut (aucune dépendance externe).
 */
final class LocalBus implements Bus
{
    /** @var callable */
    private $deliverer;

    public function onDeliver(callable $deliverer): void
    {
        $this->deliverer = $deliverer;
    }

    public function publish(int $userId, array $payload): void
    {
        if ($this->deliverer !== null) {
            ($this->deliverer)($userId, $payload);
        }
    }

    public function start(LoopInterface $loop): void
    {
        // Rien à démarrer en mono-instance.
    }
}

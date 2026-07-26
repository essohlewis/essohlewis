<?php
declare(strict_types=1);

namespace Amoura\Websocket\Bus;

use Clue\React\Redis\Client as RedisClientInterface;
use Clue\React\Redis\Factory as RedisFactory;
use React\EventLoop\LoopInterface;

/**
 * Bus Redis pub/sub : diffusion inter-instances (clustering WebSocket).
 *
 * Chaque nœud publie {to, payload} sur un canal Redis et s'y abonne. À réception,
 * il tente de distribuer localement — seul le nœud hébergeant la connexion de
 * l'utilisateur cible remettra effectivement le message. Un unique aller-retour
 * Redis garantit que le message atteint l'utilisateur quel que soit son nœud.
 *
 * Utilise clue/redis-react (client asynchrone intégré à la boucle ReactPHP) :
 * un client dédié à l'abonnement (mode SUBSCRIBE) et un client dédié à la publication.
 */
final class RedisBus implements Bus
{
    /** @var callable */
    private $deliverer;
    private ?RedisClientInterface $publisher = null;

    public function __construct(
        private string $uri,       // ex. redis://127.0.0.1:6379
        private string $channel = 'amoura:realtime'
    ) {}

    public function onDeliver(callable $deliverer): void
    {
        $this->deliverer = $deliverer;
    }

    public function publish(int $userId, array $payload): void
    {
        if ($this->publisher === null) {
            return; // le bus n'est pas encore démarré
        }
        $message = json_encode(['to' => $userId, 'payload' => $payload]);
        // Publication asynchrone (best-effort) ; les erreurs sont silencieuses.
        $this->publisher->publish($this->channel, $message)->then(null, fn() => null);
    }

    public function start(LoopInterface $loop): void
    {
        $factory = new RedisFactory($loop);

        // Client de publication (clients « lazy » : connexion et file d'attente automatiques).
        $this->publisher = $factory->createLazyClient($this->uri);

        // Client d'abonnement dédié (un client en mode SUBSCRIBE ne peut plus publier).
        $subscriber = $factory->createLazyClient($this->uri);
        $subscriber->subscribe($this->channel);
        $subscriber->on('message', function (string $channel, string $payload) {
            $data = json_decode($payload, true);
            if (is_array($data) && isset($data['to'], $data['payload']) && $this->deliverer !== null) {
                ($this->deliverer)((int) $data['to'], (array) $data['payload']);
            }
        });
    }
}

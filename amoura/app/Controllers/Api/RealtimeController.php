<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Security\WsTicket;

/** Émet un ticket d'authentification pour le serveur WebSocket. */
final class RealtimeController extends Controller
{
    public function ticket(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->json([
            'ok' => true,
            'ticket' => WsTicket::issue((int) $user['id']),
            'ws_url' => (string) Env::get('WS_PUBLIC_URL', 'ws://localhost:8090'),
        ]);
    }
}

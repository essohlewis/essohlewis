<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\Event;
use Amoura\Models\Notification;

/** Événements & communautés côté membre (Phase 5, Sprint +17). */
final class EventController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $event = new Event();
        $this->view('events/index', [
            'upcoming' => $event->upcoming(),
            'mine' => $event->forUser((int) $user['id']),
        ]);
    }

    public function show(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $event = (new Event())->bySlug((string) ($params['slug'] ?? ''));
        if (!$event || $event['status'] !== 'published') {
            http_response_code(404);
            $this->view('errors/error', ['code' => 404, 'message' => 'Événement introuvable'], null);
            return;
        }
        $this->view('events/show', [
            'event' => $event,
            'my_status' => (new Event())->attendeeStatus((int) $event['id'], (int) $user['id']),
        ]);
    }

    public function join(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $status = (new Event())->join((int) $params['id'], (int) $user['id']);

        if ($status === null) {
            Session::flash('error', 'Inscription impossible : événement clôturé ou passé.');
        } elseif ($status === 'going') {
            Session::flash('success', 'Inscription confirmée ! On a hâte de vous y voir. 🎉');
        } else {
            Session::flash('success', 'Événement complet : vous êtes sur la liste d\'attente. Nous vous préviendrons si une place se libère.');
        }
        $this->back($request);
    }

    public function leave(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $eventId = (int) $params['id'];
        $result = (new Event())->leave($eventId, (int) $user['id']);

        // Une place s'est libérée → prévient le membre promu depuis la liste d'attente.
        if ($result['promoted_user_id'] !== null) {
            (new Notification())->push($result['promoted_user_id'], 'system', null, [
                'message' => 'Une place s\'est libérée : vous êtes désormais inscrit·e à un événement ! 🎉',
            ], 'event', $eventId);
        }
        Session::flash('success', $result['left'] ? 'Vous vous êtes désinscrit·e de l\'événement.' : 'Vous n\'étiez pas inscrit·e.');
        $this->back($request);
    }

    /** Redirige vers la page précédente (liste ou détail), sans open-redirect. */
    private function back(Request $request): void
    {
        $ref = $_SERVER['HTTP_REFERER'] ?? '/events';
        $path = parse_url((string) $ref, PHP_URL_PATH) ?: '/events';
        $this->redirect($path);
    }
}

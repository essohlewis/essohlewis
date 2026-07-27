<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ActivityLog;
use Amoura\Models\Event;

/** Gestion des événements côté staff (Phase 5, Sprint +17). */
final class EventController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'cms.manage');
        $this->view('admin/events', ['events' => (new Event())->forAdmin()], 'layouts/admin');
    }

    public function create(Request $request): void
    {
        $staff = $this->requirePermission($request, 'cms.manage');
        $title = Sanitizer::text((string) $request->input('title'), 150);
        $startsAt = (string) $request->input('starts_at');

        if ($title === '' || strtotime($startsAt) === false) {
            Session::flash('error', 'Titre et date de début requis.');
            $this->redirect('/admin/events');
        }

        $type = (string) $request->input('type', 'meetup');
        $type = in_array($type, ['speed_dating', 'salon', 'meetup', 'online'], true) ? $type : 'meetup';
        $capacityRaw = (string) $request->input('capacity', '');

        $eventId = (new Event())->create([
            'host_id' => (int) $staff['id'],
            'title' => $title,
            'slug' => $this->uniqueSlug($title),
            'description' => Sanitizer::text((string) $request->input('description'), 5000),
            'type' => $type,
            'is_online' => $request->input('is_online') ? 1 : 0,
            'location' => Sanitizer::text((string) $request->input('location'), 200) ?: null,
            'capacity' => ctype_digit($capacityRaw) && (int) $capacityRaw > 0 ? (int) $capacityRaw : null,
            'starts_at' => date('Y-m-d H:i:s', strtotime($startsAt)),
            'ends_at' => ($e = (string) $request->input('ends_at')) && strtotime($e) ? date('Y-m-d H:i:s', strtotime($e)) : null,
            'status' => 'draft',
        ]);
        (new ActivityLog())->record((int) $staff['id'], 'event.create', 'event', $eventId, [], $request->ip());
        Session::flash('success', 'Événement créé (brouillon). Publiez-le pour le rendre visible.');
        $this->redirect('/admin/events');
    }

    public function setStatus(Request $request, array $params): void
    {
        $staff = $this->requirePermission($request, 'cms.manage');
        $status = (string) $request->input('status');
        if (!in_array($status, ['draft', 'published', 'canceled'], true)) {
            Session::flash('error', 'Statut invalide.');
            $this->redirect('/admin/events');
        }
        (new Event())->update((int) $params['id'], ['status' => $status]);
        (new ActivityLog())->record((int) $staff['id'], 'event.status', 'event', (int) $params['id'], ['status' => $status], $request->ip());
        Session::flash('success', 'Statut de l\'événement mis à jour.');
        $this->redirect('/admin/events');
    }

    /** Génère un slug unique à partir du titre. */
    private function uniqueSlug(string $title): string
    {
        $base = preg_replace('/[^a-z0-9]+/', '-', strtolower(self::deaccent($title)));
        $base = trim((string) $base, '-') ?: 'evenement';
        $slug = $base;
        $event = new Event();
        $i = 2;
        while ($event->findBy('slug', $slug) !== null) {
            $slug = $base . '-' . $i++;
        }
        return $slug;
    }

    private static function deaccent(string $s): string
    {
        return strtr($s, [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c',
        ]);
    }
}

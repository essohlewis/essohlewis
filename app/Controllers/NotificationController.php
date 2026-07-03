<?php

declare(strict_types=1);

namespace Transouscris\Controllers;

use Transouscris\Core\Controller;
use Transouscris\Core\Request;
use Transouscris\Core\Response;
use Transouscris\Models\Notification;

/**
 * Centre de notifications de l'utilisateur.
 */
final class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->requireUser();
        $items = Notification::forUser($user->id, 50);

        // Consulter la page marque tout comme lu.
        Notification::markAllRead($user->id);

        return $this->view('notification.index', [
            'title'         => 'Notifications',
            'notifications' => $items,
        ]);
    }

    /** Marque tout comme lu (AJAX depuis la cloche). */
    public function markAllRead(Request $request): Response
    {
        $user = $this->requireUser();
        Notification::markAllRead($user->id);
        return $this->json(['ok' => true]);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\ChildProfile;
use App\Models\ReadingProgress;
use App\Models\ScreenSession;

final class ProgressController extends Controller
{
    public function __construct(
        private ChildProfile $profiles = new ChildProfile(),
        private ReadingProgress $progress = new ReadingProgress(),
        private ScreenSession $screen = new ScreenSession(),
    ) {
    }

    /** POST /api/v1/progress (auth) */
    public function store(Request $request): void
    {
        $v = new Validator($request->all(), [
            'child_id'  => 'required|int',
            'tale_id'   => 'required|int',
            'level'     => 'required|in:N1,N2,N3',
            'last_page' => 'int',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        // Protection IDOR : l'enfant doit appartenir au parent authentifié.
        if ($this->profiles->findOwned((int) $request->input('child_id'), $this->userId()) === null) {
            Response::error('Profil introuvable.', 404);
            return;
        }

        $this->progress->upsert(
            (int) $request->input('child_id'),
            (int) $request->input('tale_id'),
            [
                'level'        => (string) $request->input('level'),
                'last_page'    => (int) $request->input('last_page', 0),
                'completed'    => (bool) $request->input('completed', false),
                'quiz_score'   => $request->input('quiz_score'),
                'last_read_at' => $request->input('last_read_at', date('Y-m-d H:i:s')),
            ]
        );

        Response::ok(['saved' => true]);
    }

    /** GET /api/v1/progress/{child_id} (auth) */
    public function show(Request $request): void
    {
        $childId = (int) $request->param('child_id');
        if ($this->profiles->findOwned($childId, $this->userId()) === null) {
            Response::error('Profil introuvable.', 404);
            return;
        }

        Response::ok([
            'progress'      => $this->progress->forChild($childId),
            'seconds_today' => $this->screen->secondsToday($childId),
        ]);
    }

    /** POST /api/v1/screen-time (auth) — incrément du temps d'écran */
    public function screenTime(Request $request): void
    {
        $v = new Validator($request->all(), [
            'child_id' => 'required|int',
            'seconds'  => 'required|int|between:0,3600',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $childId = (int) $request->input('child_id');
        $profile = $this->profiles->findOwned($childId, $this->userId());
        if ($profile === null) {
            Response::error('Profil introuvable.', 404);
            return;
        }

        $this->screen->addSeconds($childId, (int) $request->input('seconds'));

        $spent = $this->screen->secondsToday($childId);
        $limit = (int) $profile['daily_limit_minutes'] * 60;

        Response::ok([
            'seconds_today'  => $spent,
            'limit_seconds'  => $limit,
            'limit_reached'  => $spent >= $limit,
        ]);
    }
}

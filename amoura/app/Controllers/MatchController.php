<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Models\Matching;

final class MatchController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $matches = (new Matching())->forUser((int) $user['id']);
        foreach ($matches as &$m) {
            $m['avatar'] = avatar_url($m['avatar_path'] ?? null);
        }
        $this->view('messages/index', ['matches' => $matches, 'activeConversation' => null]);
    }

    public function unmatch(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        (new Matching())->unmatch((int) $user['id'], (int) $params['id']);
        if ($request->wantsJson()) {
            $this->json(['ok' => true]);
        }
        Session::flash('success', 'Match retiré.');
        $this->redirect('/matches');
    }
}

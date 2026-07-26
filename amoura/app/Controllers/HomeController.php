<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Security\Auth;
use Amoura\Models\Page;
use Amoura\Models\Plan;
use Amoura\Models\Setting;

final class HomeController extends Controller
{
    public function landing(Request $request): void
    {
        if (Auth::check()) {
            $this->redirect('/app');
        }
        $this->view('home', [
            'plans' => (new Plan())->active(),
            'settings' => (new Setting())->values(),
        ], 'layouts/public');
    }

    public function page(Request $request, array $params): void
    {
        $page = (new Page())->bySlug((string) $params['slug']);
        if (!$page) {
            http_response_code(404);
            $this->view('errors/error', ['code' => 404, 'message' => 'Page introuvable'], 'layouts/public');
            return;
        }
        $this->view('page', ['page' => $page], 'layouts/public');
    }
}

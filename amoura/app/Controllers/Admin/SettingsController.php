<?php
declare(strict_types=1);

namespace Amoura\Controllers\Admin;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Session;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ActivityLog;
use Amoura\Models\Page;
use Amoura\Models\Setting;

/** Paramètres du site (CMS) + pages statiques éditables. */
final class SettingsController extends Controller
{
    public function index(Request $request): void
    {
        $this->requirePermission($request, 'settings.view');
        $this->view('admin/settings', [
            'grouped' => (new Setting())->grouped(),
        ], 'layouts/admin');
    }

    public function update(Request $request): void
    {
        $staff = $this->requirePermission($request, 'settings.update');
        $settings = new Setting();
        $updated = [];
        foreach ($request->all() as $key => $value) {
            if ($key === '_csrf' || $key === '_method') {
                continue;
            }
            // Les clés autorisées sont celles déjà présentes en base (liste blanche).
            if ($settings->get($key, '__missing__') !== '__missing__') {
                $settings->set($key, Sanitizer::text((string) $value, 5000));
                $updated[] = $key;
            }
        }
        (new ActivityLog())->record((int) $staff['id'], 'settings.update', null, null, ['keys' => $updated], $request->ip());
        Session::flash('success', 'Paramètres enregistrés.');
        $this->redirect('/admin/settings');
    }

    public function pages(Request $request): void
    {
        $this->requirePermission($request, 'cms.manage');
        $this->view('admin/pages', [
            'pages' => (new Page())->allForAdmin(),
        ], 'layouts/admin');
    }

    public function savePage(Request $request): void
    {
        $staff = $this->requirePermission($request, 'cms.manage');
        $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower((string) $request->input('slug'))) ?: 'page';
        (new Page())->save(
            $slug,
            Sanitizer::text((string) $request->input('title'), 190),
            Sanitizer::richText((string) $request->input('content'), 50000),
            (bool) $request->input('is_published')
        );
        (new ActivityLog())->record((int) $staff['id'], 'page.save', 'page', null, ['slug' => $slug], $request->ip());
        Session::flash('success', 'Page enregistrée.');
        $this->redirect('/admin/pages');
    }
}

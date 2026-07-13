<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Database;
use App\Core\Request;
use App\Helpers\Csrf;
use App\Helpers\Sanitize;
use App\Models\Tale;

final class TaleAdminController extends AdminController
{
    /** GET /admin/tales */
    public function index(Request $request): void
    {
        $this->requireAdmin();
        $db = Database::connection();
        $tales = $db->query(
            'SELECT t.*, p.title AS pack_title,
                    (SELECT COUNT(*) FROM tale_versions v WHERE v.tale_id = t.id) AS version_count
             FROM tales t LEFT JOIN packs p ON p.id = t.pack_id
             ORDER BY t.sort_order ASC, t.id ASC'
        )->fetchAll();
        $this->view('tales', ['tales' => $tales, 'active' => 'tales']);
    }

    /** GET /admin/tales/new */
    public function createForm(Request $request): void
    {
        $this->requireAdmin();
        $packs = Database::connection()->query('SELECT id, title FROM packs ORDER BY title')->fetchAll();
        $this->view('tale_form', ['packs' => $packs, 'tale' => null, 'active' => 'tales']);
    }

    /** POST /admin/tales */
    public function store(Request $request): void
    {
        $this->requireAdmin();
        if (!$this->verifyCsrf($request)) {
            $this->redirect('/admin/tales');
        }

        $tale = new Tale();
        $slug = $this->slugify((string) ($_POST['slug'] ?? $_POST['title'] ?? ''));
        $packId = ($_POST['pack_id'] ?? '') !== '' ? (int) $_POST['pack_id'] : null;

        $tale->insert([
            'slug'         => $slug,
            'title'        => Sanitize::text($_POST['title'] ?? '', 200),
            'origin'       => Sanitize::text($_POST['origin'] ?? '', 100),
            'moral'        => Sanitize::text($_POST['moral'] ?? '', 1000),
            'cover_url'    => Sanitize::text($_POST['cover_url'] ?? '', 255),
            'is_free'      => isset($_POST['is_free']) ? 1 : 0,
            'pack_id'      => $packId,
            'sort_order'   => (int) ($_POST['sort_order'] ?? 0),
            'published_at' => isset($_POST['published']) ? date('Y-m-d H:i:s') : null,
        ]);

        $this->redirect('/admin/tales');
    }

    /** POST /admin/tales/{id}/delete */
    public function destroy(Request $request): void
    {
        $this->requireAdmin();
        if (!$this->verifyCsrf($request)) {
            $this->redirect('/admin/tales');
        }
        (new Tale())->delete((int) $request->param('id'));
        $this->redirect('/admin/tales');
    }

    private function slugify(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/[àâä]/u', 'a', $s) ?? $s;
        $s = preg_replace('/[éèêë]/u', 'e', $s) ?? $s;
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? $s;
        return trim($s, '-') ?: ('conte-' . time());
    }
}

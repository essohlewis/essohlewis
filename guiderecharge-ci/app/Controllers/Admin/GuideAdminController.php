<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;
use App\Models\Guide;
use App\Models\Log;
use App\Models\Operateur;

/**
 * CRUD des guides (procédures, numéros utiles, réclamations).
 */
final class GuideAdminController extends Controller
{
    private Guide $model;

    public function __construct()
    {
        parent::__construct();
        Auth::requireAdmin();
        $this->model = new Guide();
    }

    public function index(): void
    {
        $this->view('admin/guides/index', [
            'title'  => 'Guides — Administration',
            'guides' => $this->model->allAdmin(),
        ], 'admin');
    }

    public function create(): void
    {
        $this->renderForm(null, 'Nouveau guide');
    }

    public function store(): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/guides/create');
        }
        $data['created_at'] = date('Y-m-d H:i:s');
        $id = $this->model->insert($data);
        $this->log('création guide', "#{$id} {$data['titre']}");
        Session::flash('success', 'Guide créé.');
        $this->redirect('/admin/guides');
    }

    public function edit(string $id): void
    {
        $guide = $this->model->find((int) $id);
        if ($guide === null) {
            Session::flash('error', 'Guide introuvable.');
            $this->redirect('/admin/guides');
        }
        $this->renderForm($guide, 'Modifier le guide');
    }

    public function update(string $id): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/guides/' . (int) $id . '/edit');
        }
        $this->model->update((int) $id, $data);
        $this->log('modification guide', "#{$id} {$data['titre']}");
        Session::flash('success', 'Guide mis à jour.');
        $this->redirect('/admin/guides');
    }

    public function destroy(string $id): void
    {
        $this->verifyCsrf();
        $this->model->delete((int) $id);
        $this->log('suppression guide', "#{$id}");
        Session::flash('success', 'Guide supprimé.');
        $this->redirect('/admin/guides');
    }

    /**
     * @param array<string, mixed>|null $guide
     */
    private function renderForm(?array $guide, string $title): void
    {
        $this->view('admin/guides/form', [
            'title'      => $title,
            'guide'      => $guide,
            'operateurs' => (new Operateur())->all('nom'),
        ], 'admin');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function validated(): ?array
    {
        $titre = trim((string) $this->request->post('titre', ''));
        $contenu = (string) $this->request->post('contenu', '');
        $categorie = trim((string) $this->request->post('categorie', ''));
        $operateurId = $this->request->post('operateur_id', '');

        if ($titre === '' || trim($contenu) === '') {
            Session::flash('error', 'Titre et contenu sont obligatoires.');
            return null;
        }

        return [
            'titre'        => $titre,
            'slug'         => slugify((string) ($this->request->post('slug') ?: $titre)),
            // Le contenu HTML est nettoyé pour retirer les balises dangereuses.
            'contenu'      => $this->sanitizeHtml($contenu),
            'categorie'    => $categorie,
            'operateur_id' => ($operateurId !== '' && (int) $operateurId > 0) ? (int) $operateurId : null,
            'image'        => trim((string) $this->request->post('image', '')),
            'actif'        => $this->request->post('actif') ? 1 : 0,
        ];
    }

    /**
     * Nettoyage basique du HTML riche : on retire les balises script/style,
     * les gestionnaires d'événements et les URI javascript:.
     */
    private function sanitizeHtml(string $html): string
    {
        // Supprime les blocs script/style entiers.
        $html = preg_replace('#<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html) ?? $html;
        // Supprime les attributs on* (onclick, onerror, ...).
        $html = preg_replace('#\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)#i', '', $html) ?? $html;
        // Neutralise les URI javascript:.
        $html = preg_replace('#(href|src)\s*=\s*(["\']?)\s*javascript:[^"\'>]*\2#i', '$1="#"', $html) ?? $html;
        return trim($html);
    }

    private function log(string $action, string $details): void
    {
        (new Log())->adminAction((int) (Auth::user()['id'] ?? 0), $action, $details);
    }
}

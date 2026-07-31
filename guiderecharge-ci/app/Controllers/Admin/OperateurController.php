<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;
use App\Models\Log;
use App\Models\Operateur;

/**
 * CRUD des opérateurs (Orange, MTN, Moov).
 */
final class OperateurController extends Controller
{
    private Operateur $model;

    public function __construct()
    {
        parent::__construct();
        Auth::requireAdmin();
        $this->model = new Operateur();
    }

    /** Liste des opérateurs. */
    public function index(): void
    {
        $this->view('admin/operateurs/index', [
            'title'      => 'Opérateurs — Administration',
            'operateurs' => $this->model->all('nom'),
        ], 'admin');
    }

    /** Formulaire de création. */
    public function create(): void
    {
        $this->view('admin/operateurs/form', [
            'title'     => 'Nouvel opérateur',
            'operateur' => null,
        ], 'admin');
    }

    /** Enregistrement d'un nouvel opérateur. */
    public function store(): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/operateurs/create');
        }

        $id = $this->model->insert($data);
        $this->log('création opérateur', "#{$id} {$data['nom']}");
        Session::flash('success', 'Opérateur créé.');
        $this->redirect('/admin/operateurs');
    }

    /** Formulaire d'édition. */
    public function edit(string $id): void
    {
        $operateur = $this->model->find((int) $id);
        if ($operateur === null) {
            Session::flash('error', 'Opérateur introuvable.');
            $this->redirect('/admin/operateurs');
        }
        $this->view('admin/operateurs/form', [
            'title'     => 'Modifier ' . $operateur['nom'],
            'operateur' => $operateur,
        ], 'admin');
    }

    /** Mise à jour. */
    public function update(string $id): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/operateurs/' . (int) $id . '/edit');
        }

        $this->model->update((int) $id, $data);
        $this->log('modification opérateur', "#{$id} {$data['nom']}");
        Session::flash('success', 'Opérateur mis à jour.');
        $this->redirect('/admin/operateurs');
    }

    /** Suppression. */
    public function destroy(string $id): void
    {
        $this->verifyCsrf();
        $this->model->delete((int) $id);
        $this->log('suppression opérateur', "#{$id}");
        Session::flash('success', 'Opérateur supprimé.');
        $this->redirect('/admin/operateurs');
    }

    /**
     * Valide et normalise les champs du formulaire.
     *
     * @return array<string, mixed>|null
     */
    private function validated(): ?array
    {
        $nom = trim((string) $this->request->post('nom', ''));
        $couleur = trim((string) $this->request->post('couleur_hex', '#000000'));
        $prefixes = trim((string) $this->request->post('prefixes', ''));
        $ussdBase = trim((string) $this->request->post('ussd_base', ''));

        if ($nom === '') {
            Session::flash('error', 'Le nom est obligatoire.');
            return null;
        }
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $couleur)) {
            Session::flash('error', 'Couleur hexadécimale invalide (ex : #FF6600).');
            return null;
        }

        return [
            'nom'         => $nom,
            'slug'        => slugify((string) ($this->request->post('slug') ?: $nom)),
            'couleur_hex' => strtoupper($couleur),
            'logo'        => trim((string) $this->request->post('logo', '')),
            'prefixes'    => $prefixes,
            'ussd_base'   => $ussdBase,
            'actif'       => $this->request->post('actif') ? 1 : 0,
        ];
    }

    private function log(string $action, string $details): void
    {
        (new Log())->adminAction((int) (Auth::user()['id'] ?? 0), $action, $details);
    }
}

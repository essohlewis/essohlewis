<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;
use App\Models\CategorieForfait;
use App\Models\Forfait;
use App\Models\Log;
use App\Models\Operateur;

/**
 * CRUD des forfaits.
 */
final class ForfaitAdminController extends Controller
{
    private Forfait $model;

    public function __construct()
    {
        parent::__construct();
        Auth::requireAdmin();
        $this->model = new Forfait();
    }

    public function index(): void
    {
        $this->view('admin/forfaits/index', [
            'title'    => 'Forfaits — Administration',
            'forfaits' => $this->model->allAdmin(),
        ], 'admin');
    }

    public function create(): void
    {
        $this->renderForm(null, 'Nouveau forfait');
    }

    public function store(): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/forfaits/create');
        }
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['updated_at'] = date('Y-m-d H:i:s');
        $id = $this->model->insert($data);
        $this->log('création forfait', "#{$id} {$data['nom']}");
        Session::flash('success', 'Forfait créé.');
        $this->redirect('/admin/forfaits');
    }

    public function edit(string $id): void
    {
        $forfait = $this->model->find((int) $id);
        if ($forfait === null) {
            Session::flash('error', 'Forfait introuvable.');
            $this->redirect('/admin/forfaits');
        }
        $this->renderForm($forfait, 'Modifier le forfait');
    }

    public function update(string $id): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/forfaits/' . (int) $id . '/edit');
        }
        $data['updated_at'] = date('Y-m-d H:i:s');
        $this->model->update((int) $id, $data);
        $this->log('modification forfait', "#{$id} {$data['nom']}");
        Session::flash('success', 'Forfait mis à jour.');
        $this->redirect('/admin/forfaits');
    }

    public function destroy(string $id): void
    {
        $this->verifyCsrf();
        $this->model->delete((int) $id);
        $this->log('suppression forfait', "#{$id}");
        Session::flash('success', 'Forfait supprimé.');
        $this->redirect('/admin/forfaits');
    }

    /**
     * Affiche le formulaire (création/édition) avec les listes déroulantes.
     *
     * @param array<string, mixed>|null $forfait
     */
    private function renderForm(?array $forfait, string $title): void
    {
        $this->view('admin/forfaits/form', [
            'title'      => $title,
            'forfait'    => $forfait,
            'operateurs' => (new Operateur())->all('nom'),
            'categories' => (new CategorieForfait())->ordered(),
        ], 'admin');
    }

    /**
     * Valide les champs du forfait.
     *
     * @return array<string, mixed>|null
     */
    private function validated(): ?array
    {
        $nom = trim((string) $this->request->post('nom', ''));
        $operateurId = (int) $this->request->post('operateur_id', 0);
        $categorieId = (int) $this->request->post('categorie_id', 0);
        $prix = $this->request->post('prix', '');

        if ($nom === '' || $operateurId <= 0 || $categorieId <= 0) {
            Session::flash('error', 'Nom, opérateur et catégorie sont obligatoires.');
            return null;
        }
        if ($prix === '' || !ctype_digit((string) $prix)) {
            Session::flash('error', 'Le prix doit être un entier positif (FCFA).');
            return null;
        }

        return [
            'operateur_id' => $operateurId,
            'categorie_id' => $categorieId,
            'nom'          => $nom,
            'description'  => trim((string) $this->request->post('description', '')),
            'prix'         => (int) $prix,
            'volume_data'  => trim((string) $this->request->post('volume_data', '')),
            'minutes_appel' => trim((string) $this->request->post('minutes_appel', '')),
            'sms'          => trim((string) $this->request->post('sms', '')),
            'validite'     => trim((string) $this->request->post('validite', '')),
            'code_ussd'    => trim((string) $this->request->post('code_ussd', '')),
            'populaire'    => $this->request->post('populaire') ? 1 : 0,
            'actif'        => $this->request->post('actif') ? 1 : 0,
        ];
    }

    private function log(string $action, string $details): void
    {
        (new Log())->adminAction((int) (Auth::user()['id'] ?? 0), $action, $details);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;
use App\Models\CodeUssd;
use App\Models\Log;
use App\Models\Operateur;

/**
 * CRUD des codes USSD génériques.
 */
final class CodeUssdController extends Controller
{
    private CodeUssd $model;

    /** Actions disponibles (liste blanche). */
    private const ACTIONS = [
        'achat_credit'     => 'Achat de crédit',
        'transfert_credit' => 'Transfert de crédit',
        'solde'            => 'Consultation du solde',
        'activation'       => 'Activation forfait',
        'mobile_money'     => 'Mobile Money',
    ];

    public function __construct()
    {
        parent::__construct();
        Auth::requireAdmin();
        $this->model = new CodeUssd();
    }

    public function index(): void
    {
        $this->view('admin/codes/index', [
            'title'   => 'Codes USSD — Administration',
            'codes'   => $this->model->allAdmin(),
            'actions' => self::ACTIONS,
        ], 'admin');
    }

    public function create(): void
    {
        $this->renderForm(null, 'Nouveau code USSD');
    }

    public function store(): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/codes/create');
        }
        $id = $this->model->insert($data);
        $this->log('création code USSD', "#{$id} {$data['libelle']}");
        Session::flash('success', 'Code USSD créé.');
        $this->redirect('/admin/codes');
    }

    public function edit(string $id): void
    {
        $code = $this->model->find((int) $id);
        if ($code === null) {
            Session::flash('error', 'Code introuvable.');
            $this->redirect('/admin/codes');
        }
        $this->renderForm($code, 'Modifier le code USSD');
    }

    public function update(string $id): void
    {
        $this->verifyCsrf();
        $data = $this->validated();
        if ($data === null) {
            $this->redirect('/admin/codes/' . (int) $id . '/edit');
        }
        $this->model->update((int) $id, $data);
        $this->log('modification code USSD', "#{$id} {$data['libelle']}");
        Session::flash('success', 'Code USSD mis à jour.');
        $this->redirect('/admin/codes');
    }

    public function destroy(string $id): void
    {
        $this->verifyCsrf();
        $this->model->delete((int) $id);
        $this->log('suppression code USSD', "#{$id}");
        Session::flash('success', 'Code USSD supprimé.');
        $this->redirect('/admin/codes');
    }

    /**
     * @param array<string, mixed>|null $code
     */
    private function renderForm(?array $code, string $title): void
    {
        $this->view('admin/codes/form', [
            'title'      => $title,
            'code'       => $code,
            'operateurs' => (new Operateur())->all('nom'),
            'actions'    => self::ACTIONS,
        ], 'admin');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function validated(): ?array
    {
        $operateurId = (int) $this->request->post('operateur_id', 0);
        $action = (string) $this->request->post('action', '');
        $libelle = trim((string) $this->request->post('libelle', ''));
        $pattern = trim((string) $this->request->post('pattern', ''));

        if ($operateurId <= 0 || $libelle === '' || $pattern === '') {
            Session::flash('error', 'Opérateur, libellé et pattern sont obligatoires.');
            return null;
        }
        if (!array_key_exists($action, self::ACTIONS)) {
            Session::flash('error', 'Action invalide.');
            return null;
        }

        return [
            'operateur_id' => $operateurId,
            'action'       => $action,
            'libelle'      => $libelle,
            'pattern'      => $pattern,
            'description'  => trim((string) $this->request->post('description', '')),
        ];
    }

    private function log(string $action, string $details): void
    {
        (new Log())->adminAction((int) (Auth::user()['id'] ?? 0), $action, $details);
    }
}

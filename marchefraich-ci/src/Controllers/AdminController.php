<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Session;
use App\Models\Marche;
use App\Models\Vendeuse;
use App\Models\Commande;
use App\Models\Coursier;

class AdminController extends Controller
{
    private function exigerAdmin(): array
    {
        Session::exiger('admin', $this->url('/admin/connexion'));
        return Session::utilisateur('admin');
    }

    /** Tableau de bord : statistiques globales. */
    public function tableauBord(): void
    {
        $this->exigerAdmin();
        $this->rendre('admin/tableau_bord', [
            'titre'  => 'Administration',
            'stats'  => (new Commande())->statistiques(),
            'config' => $this->config,
        ]);
    }

    /** Gestion des marchés. */
    public function marches(): void
    {
        $this->exigerAdmin();
        $model = new Marche();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            if ($this->post('action') === 'creer' && $this->post('nom') !== '') {
                $model->creer(
                    $this->post('nom'),
                    $this->post('quartier'),
                    $this->post('ville') !== '' ? $this->post('ville') : 'Abidjan',
                    $this->post('adresse')
                );
                Session::flash('succes', 'Marché créé.');
            } elseif ($this->post('action') === 'basculer') {
                $model->basculerActif((int) $this->post('marche_id'));
                Session::flash('succes', 'Statut du marché mis à jour.');
            }
            $this->rediriger('/admin/marches');
        }
        $this->rendre('admin/marches', [
            'titre'   => 'Marchés',
            'marches' => $model->tous(),
        ]);
    }

    /** Validation / suspension des vendeuses. */
    public function vendeuses(): void
    {
        $this->exigerAdmin();
        $model = new Vendeuse();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $statut = $this->post('statut');
            if (in_array($statut, ['validee', 'suspendue', 'en_attente'], true)) {
                $model->definirStatut((int) $this->post('vendeuse_id'), $statut);
                Session::flash('succes', 'Vendeuse mise à jour.');
            }
            $this->rediriger('/admin/vendeuses');
        }
        $this->rendre('admin/vendeuses', [
            'titre'     => 'Vendeuses',
            'vendeuses' => $model->toutes(),
        ]);
    }

    /** Liste des coursiers (supervision). */
    public function coursiers(): void
    {
        $this->exigerAdmin();
        $this->rendre('admin/coursiers', [
            'titre'     => 'Coursiers',
            'coursiers' => (new Coursier())->tous(),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Session;
use App\Models\Commande;
use App\Models\Coursier;

class CoursierController extends Controller
{
    private function exigerCoursier(): array
    {
        Session::exiger('coursier', $this->url('/coursier/connexion'));
        return Session::utilisateur('coursier');
    }

    /** Écran principal : mes courses en cours + courses disponibles. */
    public function tableauBord(): void
    {
        $c = $this->exigerCoursier();
        $model = new Commande();
        $this->rendre('coursier/tableau_bord', [
            'titre'        => 'Espace coursier',
            'coursier'     => $c,
            'mesCourses'   => $model->coursesDuCoursier((int) $c['id']),
            'disponibles'  => $model->coursesDisponibles(),
        ]);
    }

    /** Le coursier accepte une course disponible. */
    public function accepter(string $id): void
    {
        $c = $this->exigerCoursier();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $ok = (new Commande())->accepterCourse((int) $id, (int) $c['id']);
            Session::flash(
                $ok ? 'succes' : 'erreur',
                $ok ? 'Course acceptée. Bonne livraison !' : 'Cette course a déjà été prise.'
            );
        }
        $this->rediriger('/coursier');
    }

    /** Marque une course comme livrée (ou signale un incident/annulation). */
    public function terminer(string $id): void
    {
        $c = $this->exigerCoursier();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $model = new Commande();
            $commande = $model->trouver((int) $id);
            if ($commande !== null && (int) $commande['coursier_id'] === (int) $c['id']) {
                $statut = $this->post('statut') === 'annulee' ? 'annulee' : 'livree';
                $model->definirStatut((int) $id, $statut);
                Session::flash('succes', 'Commande marquée « ' . libelleStatut($statut) . ' ».');
            }
        }
        $this->rediriger('/coursier');
    }

    /** Bascule la disponibilité du coursier. */
    public function basculerDisponibilite(): void
    {
        $c = $this->exigerCoursier();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $nouveau = (int) $c['disponible'] === 1 ? false : true;
            (new Coursier())->definirDisponibilite((int) $c['id'], $nouveau);
            $c['disponible'] = $nouveau ? 1 : 0;
            Session::connecter('coursier', $c);
        }
        $this->rediriger('/coursier');
    }
}

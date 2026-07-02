<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Session;
use App\Core\TeleverseImage;
use App\Models\Client;
use App\Models\Vendeuse;
use App\Models\Coursier;
use App\Models\Admin;
use App\Models\Marche;

/**
 * Authentification et inscription pour les quatre rôles.
 * Identifiant de connexion : téléphone (clients, vendeuses, coursiers)
 * ou email (administrateur).
 */
class AuthController extends Controller
{
    use TeleverseImage;

    // ---------------- CLIENT ----------------

    public function connexionClient(): void
    {
        if ($this->estPost()) {
            $tel = $this->post('telephone');
            $mdp = $this->post('mot_de_passe');
            $client = (new Client())->parTelephone($tel);
            if ($client && password_verify($mdp, $client['mot_de_passe'])) {
                Session::connecter('client', $client);
                $this->rediriger('/client');
            }
            Session::flash('erreur', 'Téléphone ou mot de passe incorrect.');
        }
        $this->rendre('auth/connexion', [
            'titre' => 'Connexion client', 'role' => 'client',
            'action' => $this->url('/connexion'),
            'lienInscription' => $this->url('/inscription'),
        ]);
    }

    public function inscriptionClient(): void
    {
        if ($this->estPost()) {
            $this->verifierCsrfOuStop();
            $tel = $this->post('telephone');
            $model = new Client();
            if ($model->parTelephone($tel)) {
                Session::flash('erreur', 'Ce numéro est déjà utilisé.');
            } elseif (strlen($this->post('mot_de_passe')) < 4) {
                Session::flash('erreur', 'Le mot de passe doit faire au moins 4 caractères.');
            } else {
                $id = $model->creer([
                    'nom'          => $this->post('nom'),
                    'telephone'    => $tel,
                    'mot_de_passe' => $this->post('mot_de_passe'),
                    'quartier'     => $this->post('quartier'),
                    'adresse'      => $this->post('adresse'),
                ]);
                Session::connecter('client', $model->trouver($id));
                Session::flash('succes', 'Bienvenue sur MarchéFraîch !');
                $this->rediriger('/client');
            }
        }
        $this->rendre('auth/inscription_client', [
            'titre' => 'Inscription client',
            'action' => $this->url('/inscription'),
        ]);
    }

    public function deconnexionClient(): void
    {
        Session::deconnecter('client');
        $this->rediriger('/');
    }

    // ---------------- VENDEUSE ----------------

    public function connexionVendeuse(): void
    {
        if ($this->estPost()) {
            $v = (new Vendeuse())->parTelephone($this->post('telephone'));
            if ($v && password_verify($this->post('mot_de_passe'), $v['mot_de_passe'])) {
                if ($v['statut'] === 'suspendue') {
                    Session::flash('erreur', 'Votre compte est suspendu. Contactez l\'administrateur.');
                } else {
                    Session::connecter('vendeuse', $v);
                    $this->rediriger('/vendeuse');
                }
            } else {
                Session::flash('erreur', 'Téléphone ou mot de passe incorrect.');
            }
        }
        $this->rendre('auth/connexion', [
            'titre' => 'Connexion vendeuse', 'role' => 'vendeuse',
            'action' => $this->url('/vendeuse/connexion'),
            'lienInscription' => $this->url('/vendeuse/inscription'),
        ]);
    }

    public function inscriptionVendeuse(): void
    {
        $model = new Vendeuse();
        if ($this->estPost()) {
            $this->verifierCsrfOuStop();
            $tel = $this->post('telephone');
            if ($model->parTelephone($tel)) {
                Session::flash('erreur', 'Ce numéro est déjà utilisé.');
            } else {
                $photo = $this->televerserImage('photo_etal', 'etal');
                $id = $model->creer([
                    'marche_id'    => (int) $this->post('marche_id'),
                    'nom'          => $this->post('nom'),
                    'telephone'    => $tel,
                    'mot_de_passe' => $this->post('mot_de_passe'),
                    'description'  => $this->post('description'),
                    'photo_etal'   => $photo,
                ]);
                Session::connecter('vendeuse', $model->trouver($id));
                Session::flash('succes', 'Compte créé. Vous pouvez ajouter vos produits. La validation par l\'administrateur rendra votre boutique visible aux clients.');
                $this->rediriger('/vendeuse');
            }
        }
        $this->rendre('auth/inscription_vendeuse', [
            'titre' => 'Inscription vendeuse',
            'action' => $this->url('/vendeuse/inscription'),
            'marches' => (new Marche())->tousActifs(),
        ]);
    }

    public function deconnexionVendeuse(): void
    {
        Session::deconnecter('vendeuse');
        $this->rediriger('/');
    }

    // ---------------- COURSIER ----------------

    public function connexionCoursier(): void
    {
        if ($this->estPost()) {
            $c = (new Coursier())->parTelephone($this->post('telephone'));
            if ($c && password_verify($this->post('mot_de_passe'), $c['mot_de_passe'])) {
                Session::connecter('coursier', $c);
                $this->rediriger('/coursier');
            }
            Session::flash('erreur', 'Téléphone ou mot de passe incorrect.');
        }
        $this->rendre('auth/connexion', [
            'titre' => 'Connexion coursier', 'role' => 'coursier',
            'action' => $this->url('/coursier/connexion'),
            'lienInscription' => $this->url('/coursier/inscription'),
        ]);
    }

    public function inscriptionCoursier(): void
    {
        $model = new Coursier();
        if ($this->estPost()) {
            $this->verifierCsrfOuStop();
            $tel = $this->post('telephone');
            if ($model->parTelephone($tel)) {
                Session::flash('erreur', 'Ce numéro est déjà utilisé.');
            } else {
                $id = $model->creer([
                    'nom'          => $this->post('nom'),
                    'telephone'    => $tel,
                    'mot_de_passe' => $this->post('mot_de_passe'),
                    'zone'         => $this->post('zone'),
                ]);
                Session::connecter('coursier', $model->trouver($id));
                Session::flash('succes', 'Compte coursier créé.');
                $this->rediriger('/coursier');
            }
        }
        $this->rendre('auth/inscription_coursier', [
            'titre' => 'Inscription coursier',
            'action' => $this->url('/coursier/inscription'),
        ]);
    }

    public function deconnexionCoursier(): void
    {
        Session::deconnecter('coursier');
        $this->rediriger('/');
    }

    // ---------------- ADMIN ----------------

    public function connexionAdmin(): void
    {
        if ($this->estPost()) {
            $a = (new Admin())->parEmail($this->post('email'));
            if ($a && password_verify($this->post('mot_de_passe'), $a['mot_de_passe'])) {
                Session::connecter('admin', $a);
                $this->rediriger('/admin');
            }
            Session::flash('erreur', 'Identifiants administrateur incorrects.');
        }
        $this->rendre('auth/connexion_admin', [
            'titre' => 'Connexion administrateur',
            'action' => $this->url('/admin/connexion'),
        ]);
    }

    public function deconnexionAdmin(): void
    {
        Session::deconnecter('admin');
        $this->rediriger('/');
    }

    // ---------------- Helpers ----------------

    private function verifierCsrfOuStop(): void
    {
        if (!Session::verifierCsrf($this->post('csrf'))) {
            http_response_code(419);
            Session::flash('erreur', 'Session expirée, veuillez réessayer.');
            $this->rediriger('/');
        }
    }
}

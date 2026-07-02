<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Session;
use App\Core\TeleverseImage;
use App\Models\Produit;
use App\Models\Commande;

class VendeuseController extends Controller
{
    use TeleverseImage;

    private function exigerVendeuse(): array
    {
        Session::exiger('vendeuse', $this->url('/vendeuse/connexion'));
        return Session::utilisateur('vendeuse');
    }

    /** Tableau de bord : commandes du jour + revenus du jour. */
    public function tableauBord(): void
    {
        $v = $this->exigerVendeuse();
        $model = new Commande();
        $this->rendre('vendeuse/tableau_bord', [
            'titre'     => 'Tableau de bord',
            'vendeuse'  => $v,
            'commandes' => $model->parVendeuse((int) $v['id'], true),
            'revenus'   => $model->revenusDuJour((int) $v['id']),
            'validee'   => $v['statut'] === 'validee',
        ]);
    }

    /** Liste des produits (gestion). */
    public function produits(): void
    {
        $v = $this->exigerVendeuse();
        $this->rendre('vendeuse/produits', [
            'titre'    => 'Mes produits',
            'vendeuse' => $v,
            'produits' => (new Produit())->parVendeuse((int) $v['id']),
        ]);
    }

    /** Formulaire d'ajout / traitement. */
    public function ajouterProduit(): void
    {
        $v = $this->exigerVendeuse();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $erreur = $this->validerProduit();
            if ($erreur !== null) {
                Session::flash('erreur', $erreur);
                $this->rediriger('/vendeuse/produits/ajouter');
            }
            $photo = $this->televerserImage('photo', 'produit');
            (new Produit())->creer([
                'vendeuse_id'         => (int) $v['id'],
                'nom'                 => $this->post('nom'),
                'description'         => $this->post('description'),
                'categorie'           => $this->post('categorie'),
                'prix_xof'            => (int) $this->post('prix_xof'),
                'unite'               => $this->post('unite') !== '' ? $this->post('unite') : 'unité',
                'quantite_disponible' => (int) $this->post('quantite_disponible'),
                'photo'               => $photo,
            ]);
            Session::flash('succes', 'Produit ajouté.');
            $this->rediriger('/vendeuse/produits');
        }
        $this->rendre('vendeuse/produit_form', [
            'titre'    => 'Ajouter un produit',
            'vendeuse' => $v,
            'produit'  => null,
            'action'   => $this->url('/vendeuse/produits/ajouter'),
        ]);
    }

    /** Formulaire d'édition / traitement. */
    public function modifierProduit(string $id): void
    {
        $v = $this->exigerVendeuse();
        $model = new Produit();
        $produit = $model->trouver((int) $id);
        if ($produit === null || (int) $produit['vendeuse_id'] !== (int) $v['id']) {
            Session::flash('erreur', 'Produit introuvable.');
            $this->rediriger('/vendeuse/produits');
        }
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            $erreur = $this->validerProduit();
            if ($erreur !== null) {
                Session::flash('erreur', $erreur);
                $this->rediriger('/vendeuse/produits/' . $id . '/modifier');
            }
            $model->modifier((int) $id, (int) $v['id'], [
                'nom'                 => $this->post('nom'),
                'description'         => $this->post('description'),
                'categorie'           => $this->post('categorie'),
                'prix_xof'            => (int) $this->post('prix_xof'),
                'unite'               => $this->post('unite') !== '' ? $this->post('unite') : 'unité',
                'quantite_disponible' => (int) $this->post('quantite_disponible'),
                'actif'               => $this->post('actif') === '1' ? 1 : 0,
            ]);
            $photo = $this->televerserImage('photo', 'produit');
            if ($photo !== null) {
                $model->enregistrerPhoto((int) $id, $photo);
            }
            Session::flash('succes', 'Produit mis à jour.');
            $this->rediriger('/vendeuse/produits');
        }
        $this->rendre('vendeuse/produit_form', [
            'titre'    => 'Modifier le produit',
            'vendeuse' => $v,
            'produit'  => $produit,
            'action'   => $this->url('/vendeuse/produits/' . $id . '/modifier'),
        ]);
    }

    public function supprimerProduit(string $id): void
    {
        $v = $this->exigerVendeuse();
        if ($this->estPost() && Session::verifierCsrf($this->post('csrf'))) {
            (new Produit())->supprimer((int) $id, (int) $v['id']);
            Session::flash('succes', 'Produit supprimé.');
        }
        $this->rediriger('/vendeuse/produits');
    }

    /** Détail d'une commande côté vendeuse + changement de statut. */
    public function commande(string $id): void
    {
        $v = $this->exigerVendeuse();
        $model = new Commande();
        $commande = $model->trouver((int) $id);
        if ($commande === null || (int) $commande['vendeuse_id'] !== (int) $v['id']) {
            Session::flash('erreur', 'Commande introuvable.');
            $this->rediriger('/vendeuse');
        }
        $this->rendre('vendeuse/commande', [
            'titre'    => 'Commande ' . $commande['reference'],
            'vendeuse' => $v,
            'commande' => $commande,
            'lignes'   => $model->lignes((int) $id),
        ]);
    }

    /** La vendeuse fait avancer le statut (reçue -> en préparation -> ...). */
    public function changerStatut(string $id): void
    {
        $v = $this->exigerVendeuse();
        if (!$this->estPost() || !Session::verifierCsrf($this->post('csrf'))) {
            $this->rediriger('/vendeuse');
        }
        $model = new Commande();
        $commande = $model->trouver((int) $id);
        if ($commande === null || (int) $commande['vendeuse_id'] !== (int) $v['id']) {
            $this->rediriger('/vendeuse');
        }
        $nouveau = $this->post('statut');
        // La vendeuse gère la préparation ; la livraison est pilotée par le coursier.
        $autorises = ['en_preparation', 'annulee'];
        if (in_array($nouveau, $autorises, true)) {
            $model->definirStatut((int) $id, $nouveau);
            Session::flash('succes', 'Statut mis à jour : ' . libelleStatut($nouveau) . '.');
        }
        $this->rediriger('/vendeuse/commande/' . $id);
    }

    /** Contrôle basique des champs produit. */
    private function validerProduit(): ?string
    {
        if ($this->post('nom') === '') {
            return 'Le nom du produit est obligatoire.';
        }
        if ((int) $this->post('prix_xof') <= 0) {
            return 'Le prix doit être supérieur à zéro.';
        }
        if ((int) $this->post('quantite_disponible') < 0) {
            return 'La quantité ne peut pas être négative.';
        }
        return null;
    }
}

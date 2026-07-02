<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Session;
use App\Core\Panier;
use App\Models\Marche;
use App\Models\Vendeuse;
use App\Models\Produit;
use App\Models\Commande;
use App\Models\Paiement;
use App\Services\CinetPay;

class ClientController extends Controller
{
    private function exigerClient(): array
    {
        Session::exiger('client', $this->url('/connexion'));
        return Session::utilisateur('client');
    }

    /** Tableau de bord client : accès rapide catalogue + commandes. */
    public function accueil(): void
    {
        $client = $this->exigerClient();
        $this->rendre('client/accueil', [
            'titre'   => 'Mon espace',
            'client'  => $client,
            'marches' => (new Marche())->tousActifs(),
        ]);
    }

    /** Catalogue : les vendeuses validées d'un marché. */
    public function catalogue(string $marcheId): void
    {
        $this->exigerClient();
        $marche = (new Marche())->trouver((int) $marcheId);
        if ($marche === null) {
            $this->rediriger('/client');
        }
        $this->rendre('client/catalogue', [
            'titre'     => 'Marché ' . $marche['nom'],
            'marche'    => $marche,
            'vendeuses' => (new Vendeuse())->valideesParMarche((int) $marcheId),
        ]);
    }

    /** Boutique d'une vendeuse : ses produits disponibles. */
    public function boutique(string $vendeuseId): void
    {
        $this->exigerClient();
        $vendeuse = (new Vendeuse())->trouver((int) $vendeuseId);
        if ($vendeuse === null || $vendeuse['statut'] !== 'validee') {
            Session::flash('erreur', 'Boutique indisponible.');
            $this->rediriger('/client');
        }
        $this->rendre('client/boutique', [
            'titre'    => $vendeuse['nom'],
            'vendeuse' => $vendeuse,
            'produits' => (new Produit())->disponiblesParVendeuse((int) $vendeuseId),
        ]);
    }

    /** Ajoute un produit au panier. */
    public function ajouterPanier(): void
    {
        $this->exigerClient();
        $produit = (new Produit())->trouver((int) $this->post('produit_id'));
        if ($produit === null) {
            Session::flash('erreur', 'Produit introuvable.');
            $this->rediriger('/client');
        }
        $qte = max(1, (int) $this->post('quantite', '1'));
        $memeVendeuse = Panier::ajouter((int) $produit['id'], (int) $produit['vendeuse_id'], $qte);
        if (!$memeVendeuse) {
            Session::flash('info', 'Votre panier a été réinitialisé : une commande concerne une seule vendeuse.');
        } else {
            Session::flash('succes', $produit['nom'] . ' ajouté au panier.');
        }
        $this->rediriger('/client/boutique/' . $produit['vendeuse_id']);
    }

    /** Affiche le panier avec récapitulatif des montants. */
    public function panier(): void
    {
        $this->exigerClient();
        [$lignes, $vendeuse, $totaux] = $this->calculerPanier();
        $this->rendre('client/panier', [
            'titre'    => 'Mon panier',
            'lignes'   => $lignes,
            'vendeuse' => $vendeuse,
            'totaux'   => $totaux,
        ]);
    }

    public function majPanier(): void
    {
        $this->exigerClient();
        $produitId = (int) $this->post('produit_id');
        if ($this->post('action') === 'retirer') {
            Panier::retirer($produitId);
        } else {
            Panier::definirQuantite($produitId, (int) $this->post('quantite', '1'));
        }
        $this->rediriger('/client/panier');
    }

    /** Page de validation de commande (adresse, paiement). */
    public function commander(): void
    {
        $client = $this->exigerClient();
        [$lignes, $vendeuse, $totaux] = $this->calculerPanier();
        if ($lignes === []) {
            Session::flash('info', 'Votre panier est vide.');
            $this->rediriger('/client/panier');
        }
        $this->rendre('client/commander', [
            'titre'    => 'Valider la commande',
            'client'   => $client,
            'lignes'   => $lignes,
            'vendeuse' => $vendeuse,
            'totaux'   => $totaux,
        ]);
    }

    /** Traite la commande : création + paiement. */
    public function validerCommande(): void
    {
        $client = $this->exigerClient();
        if (!$this->estPost() || !Session::verifierCsrf($this->post('csrf'))) {
            $this->rediriger('/client/panier');
        }

        $panier   = Panier::contenu();
        $vendeuseId = Panier::vendeuseId();
        if ($panier === [] || $vendeuseId === null) {
            Session::flash('info', 'Votre panier est vide.');
            $this->rediriger('/client/panier');
        }

        $vendeuse = (new Vendeuse())->trouver($vendeuseId);
        $adresse  = $this->post('adresse') !== '' ? $this->post('adresse') : ($client['adresse'] ?? '');
        if ($adresse === '') {
            Session::flash('erreur', 'Veuillez indiquer une adresse de livraison.');
            $this->rediriger('/client/commander');
        }
        $mode = in_array($this->post('mode_paiement'), ['mobile_money', 'especes'], true)
            ? $this->post('mode_paiement') : 'especes';

        try {
            $commande = (new Commande())->creerDepuisPanier(
                (int) $client['id'],
                (int) $vendeuse['id'],
                (int) $vendeuse['marche_id'],
                $panier,
                $mode,
                $adresse,
                $this->post('quartier') !== '' ? $this->post('quartier') : (string) ($client['quartier'] ?? ''),
                $this->post('notes'),
                (float) $this->config['business']['taux_commission'],
                (int) $this->config['business']['frais_livraison']
            );
        } catch (\Throwable $e) {
            Session::flash('erreur', $e->getMessage());
            $this->rediriger('/client/panier');
            return;
        }

        Panier::vider();
        $detail = (new Commande())->trouver($commande['id']);

        // Paiement Mobile Money via CinetPay (ou espèces à la livraison).
        if ($mode === 'mobile_money') {
            $methode = in_array($this->post('operateur'), ['orange_money', 'mtn_money', 'wave'], true)
                ? $this->post('operateur') : 'orange_money';
            $passerelle = new CinetPay($this->config['cinetpay']);
            $resultat = $passerelle->initier(
                $detail['reference'],
                (int) $detail['montant_total_xof'],
                $methode,
                $client
            );
            $paiementModel = new Paiement();
            if ($resultat['succes'] && $resultat['url_paiement'] === null) {
                // Mode simulation : paiement confirmé immédiatement.
                $paiementModel->creer((int) $detail['id'], (int) $detail['montant_total_xof'], $methode, 'reussi', $resultat['reference']);
                (new Commande())->definirStatutPaiement((int) $detail['id'], 'paye');
                Session::flash('succes', 'Paiement Mobile Money confirmé. Commande enregistrée !');
            } elseif ($resultat['succes'] && $resultat['url_paiement'] !== null) {
                $paiementModel->creer((int) $detail['id'], (int) $detail['montant_total_xof'], $methode, 'en_attente', $resultat['reference']);
                header('Location: ' . $resultat['url_paiement']);
                exit;
            } else {
                $paiementModel->creer((int) $detail['id'], (int) $detail['montant_total_xof'], $methode, 'echoue');
                Session::flash('erreur', $resultat['message'] . ' Commande enregistrée en paiement à la livraison.');
            }
        } else {
            (new Paiement())->creer((int) $detail['id'], (int) $detail['montant_total_xof'], 'especes', 'en_attente');
            Session::flash('succes', 'Commande enregistrée ! Paiement en espèces à la livraison.');
        }

        $this->rediriger('/client/commande/' . $detail['id']);
    }

    /** Détail + suivi d'une commande du client. */
    public function commande(string $id): void
    {
        $client = $this->exigerClient();
        $model = new Commande();
        $commande = $model->trouver((int) $id);
        if ($commande === null || (int) $commande['client_id'] !== (int) $client['id']) {
            Session::flash('erreur', 'Commande introuvable.');
            $this->rediriger('/client/commandes');
        }
        $this->rendre('client/commande', [
            'titre'    => 'Commande ' . $commande['reference'],
            'commande' => $commande,
            'lignes'   => $model->lignes((int) $id),
        ]);
    }

    /** Liste des commandes du client. */
    public function commandes(): void
    {
        $client = $this->exigerClient();
        $this->rendre('client/commandes', [
            'titre'     => 'Mes commandes',
            'commandes' => (new Commande())->parClient((int) $client['id']),
        ]);
    }

    /** API JSON : statut d'une commande (pour rafraîchissement du suivi). */
    public function statutJson(string $id): void
    {
        $client = $this->exigerClient();
        $commande = (new Commande())->trouver((int) $id);
        if ($commande === null || (int) $commande['client_id'] !== (int) $client['id']) {
            $this->json(['erreur' => 'Introuvable'], 404);
        }
        $this->json([
            'statut'         => $commande['statut'],
            'libelle'        => libelleStatut($commande['statut']),
            'statut_paiement'=> $commande['statut_paiement'],
            'coursier'       => $commande['coursier_nom'],
        ]);
    }

    /**
     * Calcule le contenu détaillé du panier + les totaux.
     * @return array{0:array,1:?array,2:array}
     */
    private function calculerPanier(): array
    {
        $contenu = Panier::contenu();
        $vendeuseId = Panier::vendeuseId();
        if ($contenu === [] || $vendeuseId === null) {
            return [[], null, ['produits' => 0, 'livraison' => 0, 'total' => 0]];
        }
        $produitModel = new Produit();
        $vendeuse = (new Vendeuse())->trouver($vendeuseId);
        $lignes = [];
        $montantProduits = 0;
        foreach ($contenu as $produitId => $quantite) {
            $produit = $produitModel->trouver((int) $produitId);
            if ($produit === null) {
                Panier::retirer((int) $produitId);
                continue;
            }
            $sousTotal = (int) $produit['prix_xof'] * (int) $quantite;
            $montantProduits += $sousTotal;
            $lignes[] = ['produit' => $produit, 'quantite' => (int) $quantite, 'sous_total' => $sousTotal];
        }
        $livraison = (int) $this->config['business']['frais_livraison'];
        return [
            $lignes,
            $vendeuse,
            [
                'produits'  => $montantProduits,
                'livraison' => $lignes === [] ? 0 : $livraison,
                'total'     => $lignes === [] ? 0 : $montantProduits + $livraison,
            ],
        ];
    }
}

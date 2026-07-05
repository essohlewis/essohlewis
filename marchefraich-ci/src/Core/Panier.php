<?php
/**
 * Panier stocké en session.
 *
 * Au MVP, une commande concerne une seule vendeuse : ajouter un produit
 * d'une autre vendeuse vide le panier précédent (comportement volontaire
 * et signalé à l'utilisateur).
 */

declare(strict_types=1);

namespace App\Core;

class Panier
{
    public static function contenu(): array
    {
        Session::demarrer();
        return $_SESSION['panier']['articles'] ?? [];
    }

    public static function vendeuseId(): ?int
    {
        Session::demarrer();
        return $_SESSION['panier']['vendeuse_id'] ?? null;
    }

    /**
     * Ajoute une quantité d'un produit. Retourne false si un changement
     * de vendeuse a réinitialisé le panier.
     */
    public static function ajouter(int $produitId, int $vendeuseId, int $quantite = 1): bool
    {
        Session::demarrer();
        $memeVendeuse = true;

        if (self::vendeuseId() !== null && self::vendeuseId() !== $vendeuseId) {
            self::vider();
            $memeVendeuse = false;
        }

        $_SESSION['panier']['vendeuse_id'] = $vendeuseId;
        $actuel = $_SESSION['panier']['articles'][$produitId] ?? 0;
        $_SESSION['panier']['articles'][$produitId] = max(1, $actuel + $quantite);

        return $memeVendeuse;
    }

    public static function definirQuantite(int $produitId, int $quantite): void
    {
        Session::demarrer();
        if ($quantite <= 0) {
            self::retirer($produitId);
            return;
        }
        if (isset($_SESSION['panier']['articles'][$produitId])) {
            $_SESSION['panier']['articles'][$produitId] = $quantite;
        }
    }

    public static function retirer(int $produitId): void
    {
        Session::demarrer();
        unset($_SESSION['panier']['articles'][$produitId]);
        if (empty($_SESSION['panier']['articles'])) {
            self::vider();
        }
    }

    public static function vider(): void
    {
        Session::demarrer();
        unset($_SESSION['panier']);
    }

    public static function nombreArticles(): int
    {
        return array_sum(self::contenu());
    }
}

<?php
/* ==========================================================================
   controllers/AdminController.php — Modération & statistiques (rôle admin).
   ========================================================================== */

class AdminController
{
    /** GET /admin/diplomes — diplômes en attente de vérification. */
    public function diplomesEnAttente(array $params): void
    {
        Auth::exigerRole('admin');
        $lignes = (new Coach())->requete(
            "SELECT d.*, c.prenom, c.nom, c.id AS coach_id
             FROM diplomes d JOIN coachs c ON c.id = d.coach_id
             WHERE d.statut = 'en_attente'"
        );
        Response::ok($lignes);
    }

    /** PATCH /admin/diplomes/:id  { statut: verifie|refuse } */
    public function statutDiplome(array $params): void
    {
        Auth::exigerRole('admin');
        $statut = Request::champ('statut');
        if (!in_array($statut, ['verifie', 'refuse'], true)) {
            Response::erreur('Statut invalide.', 422);
        }
        $pdo = Database::connexion();
        $pdo->prepare("UPDATE diplomes SET statut = ? WHERE id = ?")
            ->execute([$statut, (int) $params['id']]);
        Response::ok(['id' => (int) $params['id'], 'statut' => $statut]);
    }

    /** GET /admin/stats — indicateurs de la plateforme. */
    public function stats(array $params): void
    {
        Auth::exigerRole('admin');
        $pdo = Database::connexion();
        $un = fn($sql) => (int) $pdo->query($sql)->fetch()['n'];
        Response::ok([
            'comptes'      => $un("SELECT COUNT(*) n FROM users") + $un("SELECT COUNT(*) n FROM coachs"),
            'coachs'       => $un("SELECT COUNT(*) n FROM coachs"),
            'reservations' => $un("SELECT COUNT(*) n FROM reservations"),
            'diplomesAttente' => $un("SELECT COUNT(*) n FROM diplomes WHERE statut = 'en_attente'"),
            'volume'       => (int) ($pdo->query("SELECT COALESCE(SUM(paiement_montant),0) n FROM reservations WHERE paye = 1")->fetch()['n']),
        ]);
    }

    /** GET /admin/utilisateurs */
    public function utilisateurs(array $params): void
    {
        Auth::exigerRole('admin');
        $users = (new User())->tout('cree_le DESC');
        Response::ok(array_map([User::class, 'public'], $users));
    }

    /** GET /admin/reservations — toutes les réservations de la plateforme. */
    public function reservations(array $params): void
    {
        Auth::exigerRole('admin');
        Response::ok((new Reservation())->toutes());
    }
}

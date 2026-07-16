<?php
/* ==========================================================================
   controllers/FavoriteController.php — Favoris du client.
   ========================================================================== */

class FavoriteController
{
    /** GET /favoris — coachs favoris (complets). */
    public function index(array $params): void
    {
        $user = Auth::exiger();
        $pdo = Database::connexion();
        $ids = array_column(
            (new Coach())->requete("SELECT coach_id FROM favoris WHERE user_id = ?", [$user['id']]),
            'coach_id'
        );
        $coach = new Coach();
        $liste = array_values(array_filter(array_map(fn($id) => $coach->complet($id), $ids)));
        Response::ok($liste);
    }

    /** POST /favoris  { coachId } — bascule (ajoute/retire). */
    public function basculer(array $params): void
    {
        $user = Auth::exiger();
        $coachId = Request::champ('coachId');
        if (!$coachId) {
            Response::erreur('coachId requis.', 422);
        }
        $pdo = Database::connexion();
        $existe = $pdo->prepare("SELECT 1 FROM favoris WHERE user_id = ? AND coach_id = ?");
        $existe->execute([$user['id'], $coachId]);
        if ($existe->fetch()) {
            $pdo->prepare("DELETE FROM favoris WHERE user_id = ? AND coach_id = ?")->execute([$user['id'], $coachId]);
            Response::ok(['actif' => false]);
        } else {
            $pdo->prepare("INSERT INTO favoris (user_id, coach_id) VALUES (?, ?)")->execute([$user['id'], $coachId]);
            Response::ok(['actif' => true]);
        }
    }
}

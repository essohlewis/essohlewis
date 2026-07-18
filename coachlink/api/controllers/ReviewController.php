<?php
/* ==========================================================================
   controllers/ReviewController.php — Avis clients + réponse du coach.
   ========================================================================== */

class ReviewController
{
    /** POST /coachs/:id/avis */
    public function ajouter(array $params): void
    {
        $user = Auth::exigerRole('client');
        $d = Request::corps();
        (new Validator($d))->requis('texte')->ouEchouer();
        $note = (int) ($d['note'] ?? 0);
        if ($note < 1 || $note > 5) {
            Response::erreur('Note invalide (1 à 5).', 422);
        }

        $coach = (new Coach())->trouver($params['id']);
        if (!$coach) {
            Response::erreur('Coach introuvable.', 404);
        }

        $avis = (new Review())->ajouter($params['id'], [
            'auteur' => $user['prenom'] . ' ' . $user['nom'],
            'note'   => $note,
            'texte'  => $d['texte'],
            'video'  => isset($d['video']) ? substr(trim((string) $d['video']), 0, 255) : null,
        ]);

        if ($coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'avis',
                $user['prenom'] . ' vous a laissé un avis (' . $note . '★).', '#/espace-coach/avis');
        }
        Response::ok($avis, 201);
    }

    /** PATCH /avis/:id/reponse  { reponse } — réservé au coach. */
    public function repondre(array $params): void
    {
        Auth::exigerRole('coach');
        $reponse = Request::champ('reponse');
        if (!$reponse) {
            Response::erreur('Réponse vide.', 422);
        }
        (new Review())->repondre((int) $params['id'], $reponse);
        Response::ok(['id' => (int) $params['id'], 'reponse' => $reponse]);
    }
}

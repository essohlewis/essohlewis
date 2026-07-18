<?php
/* ==========================================================================
   controllers/EvaluationClientController.php — Le coach évalue le client.
   ========================================================================== */

class EvaluationClientController
{
    /** POST /clients/:id/evaluation  { note, texte } */
    public function evaluer(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) { Response::erreur('Profil coach introuvable.', 404); }
        $d = Request::corps();
        $note = (int) ($d['note'] ?? 0);
        if ($note < 1 || $note > 5) { Response::erreur('Note invalide (1 à 5).', 422); }
        $ev = (new EvaluationClient())->ajouter((int) $params['id'], [
            'coachId' => $coach['id'], 'coachNom' => $coach['prenom'] . ' ' . $coach['nom'],
            'note' => $note, 'texte' => $d['texte'] ?? '',
        ]);
        (new Notification())->ajouter((int) $params['id'], 'etoile',
            $coach['prenom'] . ' vous a évalué (' . $note . '★).', '#/client');
        Response::ok($ev, 201);
    }
}

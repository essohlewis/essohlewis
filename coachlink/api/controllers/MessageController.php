<?php
/* ==========================================================================
   controllers/MessageController.php — Messagerie.
   ========================================================================== */

class MessageController
{
    /** GET /conversations */
    public function conversations(array $params): void
    {
        $user = Auth::exiger();
        Response::ok((new Message())->conversationsDe((int) $user['id']));
    }

    /** POST /conversations  { autreId, autreNom } */
    public function ouvrir(array $params): void
    {
        $user = Auth::exiger();
        $d = Request::corps();
        $conv = (new Message())->ouvrir(
            (int) $user['id'], $user['prenom'] . ' ' . $user['nom'],
            (int) $d['autreId'], $d['autreNom'] ?? 'Utilisateur'
        );
        Response::ok($conv, 201);
    }

    /** POST /conversations/:id/messages  { texte } */
    public function envoyer(array $params): void
    {
        $user = Auth::exiger();
        $texte = trim((string) Request::champ('texte'));
        if ($texte === '') {
            Response::erreur('Message vide.', 422);
        }
        $model = new Message();
        $conv = $model->conversation((int) $params['id']);
        if (!$conv || !in_array((int) $user['id'], [(int) $conv['user_a'], (int) $conv['user_b']], true)) {
            Response::erreur('Conversation introuvable.', 404);
        }
        $msg = $model->envoyer((int) $params['id'], (int) $user['id'], $texte);

        $destinataire = (int) $conv['user_a'] === (int) $user['id'] ? (int) $conv['user_b'] : (int) $conv['user_a'];
        (new Notification())->ajouter($destinataire, 'message',
            'Nouveau message de ' . $user['prenom'] . '.', '#/messages');
        Response::ok($msg, 201);
    }

    /** POST /conversations/:id/lu */
    public function marquerLu(array $params): void
    {
        $user = Auth::exiger();
        (new Message())->marquerLu((int) $params['id'], (int) $user['id']);
        Response::ok(true);
    }
}

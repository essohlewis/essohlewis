<?php
/* ==========================================================================
   controllers/NotificationController.php — Centre de notifications.
   ========================================================================== */

class NotificationController
{
    /** GET /notifications */
    public function index(array $params): void
    {
        $user = Auth::exiger();
        $model = new Notification();
        Response::ok([
            'items'     => $model->parUtilisateur((int) $user['id']),
            'nonLues'   => $model->nbNonLues((int) $user['id']),
        ]);
    }

    /** PATCH /notifications/:id/lue */
    public function lue(array $params): void
    {
        Auth::exiger();
        (new Notification())->marquerLue((int) $params['id']);
        Response::ok(['id' => (int) $params['id']]);
    }

    /** POST /notifications/toutes-lues */
    public function toutesLues(array $params): void
    {
        $user = Auth::exiger();
        (new Notification())->marquerToutesLues((int) $user['id']);
        Response::ok(true);
    }
}

<?php
/* ==========================================================================
   controllers/PaiementController.php — Webhook de confirmation Mobile Money.
   L'opérateur appelle cette route quand le client a validé le paiement sur son
   téléphone. On marque alors la réservation comme payée.

   Sécurité : en production, vérifiez la SIGNATURE propre à chaque opérateur.
   Ici, une vérification par secret partagé (en-tête X-Callback-Secret) est
   fournie comme garde-fou minimal (config paiement.callback_secret).
   ========================================================================== */

class PaiementController
{
    /** POST /paiements/callback */
    public function callback(array $params): void
    {
        $secret = App::config('paiement', [])['callback_secret'] ?? '';
        if ($secret !== '' && !hash_equals($secret, (string) Request::entete('X-Callback-Secret'))) {
            Response::erreur('Webhook non authentifié.', 401);
        }

        $d      = Request::corps();
        $ref    = $d['client_reference'] ?? $d['orderId'] ?? null; // = id de la réservation
        $statut = strtolower((string) ($d['status'] ?? $d['statut'] ?? ''));
        $reussi = in_array($statut, ['success', 'successful', 'succeeded', 'complete', 'reussi'], true);

        if ($ref === null || $ref === '') {
            Response::erreur('Référence de transaction manquante.', 422);
        }

        $model = new Reservation();
        $resa  = $model->trouver((int) $ref);

        if ($resa && $reussi && !(int) $resa['paye']) {
            $resa = $model->payer((int) $ref, [
                'operateur' => $d['operator'] ?? $d['operateur'] ?? '',
                'numero'    => $d['msisdn'] ?? $d['numero'] ?? '',
                'reference' => $d['transaction_id'] ?? $d['reference'] ?? ('MM' . time()),
            ]);
            $coach = (new Coach())->trouver($resa['coach_id']);
            if ($coach && $coach['proprietaire']) {
                (new Notification())->ajouter((int) $coach['proprietaire'], 'paiement',
                    $resa['client_nom'] . ' a payé « ' . $resa['tarif_nom'] . ' ».', '#/espace-coach/reservations');
            }
        }

        // On répond toujours 200 pour éviter les renvois en boucle de l'opérateur.
        Response::ok(['recu' => true, 'reference' => (string) $ref]);
    }
}

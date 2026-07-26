<?php
declare(strict_types=1);

namespace Amoura\Services\Billing;

use Amoura\Core\Database;
use Amoura\Models\Notification;
use Amoura\Services\PushService;

/**
 * Relances d'abonnement (dunning) — Sprint +5.
 * Enchaîne les états au fil du temps (exécuté par cron) :
 *   1) rappel J-3 avant expiration (abonnement encore actif) ;
 *   2) passage en « past_due » à l'échéance dépassée (période de grâce) ;
 *   3) passage en « expired » après la période de grâce (3 jours).
 *
 * La facturation réelle (recharge de carte) dépend du prestataire ; ici on gère
 * la machine à états et les notifications qui l'accompagnent.
 */
final class Dunning
{
    private const GRACE_DAYS = 3;
    private const REMIND_DAYS = 3;

    /** @return array<string,int> compteurs par transition. */
    public static function run(): array
    {
        $db = Database::connection();
        $notif = new Notification();
        $push = new PushService();
        $counts = ['reminded' => 0, 'past_due' => 0, 'expired' => 0];

        // 1) Rappel avant expiration : actif, échéance dans les 3 jours, pas déjà relancé.
        $soon = $db->query(
            'SELECT id, user_id FROM subscriptions
             WHERE status = "active" AND current_period_end IS NOT NULL
               AND current_period_end BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ' . self::REMIND_DAYS . ' DAY)
               AND reminder_sent_at IS NULL'
        )->fetchAll();
        foreach ($soon as $s) {
            $notif->push((int) $s['user_id'], 'payment', null, ['message' => 'Votre abonnement expire bientôt. Renouvelez pour garder vos avantages.']);
            $push->sendToUser((int) $s['user_id'], ['title' => 'Abonnement bientôt expiré', 'body' => 'Renouvelez pour garder vos avantages.', 'url' => '/premium']);
            $db->prepare('UPDATE subscriptions SET reminder_sent_at = NOW() WHERE id = ?')->execute([$s['id']]);
            $counts['reminded']++;
        }

        // 2) Échéance dépassée → past_due (période de grâce).
        $due = $db->query(
            'SELECT id, user_id FROM subscriptions
             WHERE status = "active" AND current_period_end IS NOT NULL AND current_period_end < NOW()'
        )->fetchAll();
        foreach ($due as $s) {
            $db->prepare('UPDATE subscriptions SET status = "past_due", reminder_sent_at = NOW() WHERE id = ?')->execute([$s['id']]);
            $notif->push((int) $s['user_id'], 'payment', null, ['message' => 'Le renouvellement de votre abonnement a échoué. Mettez à jour votre paiement.']);
            $push->sendToUser((int) $s['user_id'], ['title' => 'Paiement en échec', 'body' => 'Mettez à jour votre moyen de paiement.', 'url' => '/premium']);
            $counts['past_due']++;
        }

        // 3) Fin de période de grâce → expired.
        $expired = $db->query(
            'SELECT id, user_id FROM subscriptions
             WHERE status = "past_due" AND current_period_end IS NOT NULL
               AND current_period_end < DATE_SUB(NOW(), INTERVAL ' . self::GRACE_DAYS . ' DAY)'
        )->fetchAll();
        foreach ($expired as $s) {
            $db->prepare('UPDATE subscriptions SET status = "expired" WHERE id = ?')->execute([$s['id']]);
            $notif->push((int) $s['user_id'], 'payment', null, ['message' => 'Votre abonnement a expiré. Réabonnez-vous quand vous le souhaitez.']);
            $counts['expired']++;
        }

        return $counts;
    }
}

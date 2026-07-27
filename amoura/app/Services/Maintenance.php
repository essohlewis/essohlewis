<?php
declare(strict_types=1);

namespace Amoura\Services;

use Amoura\Core\Database;

/**
 * Tâches de maintenance planifiées (feuille de route — Phase 1).
 * À exécuter périodiquement via cron : `php scripts/cron.php`.
 * Purge les données éphémères/expirées pour garder la base saine.
 */
final class Maintenance
{
    /** @return array<string,int> nombre de lignes supprimées par catégorie. */
    public static function run(): array
    {
        $db = Database::connection();
        $deleted = [];

        // 1) Statuts (stories) expirés + leurs vues (cascade FK).
        $deleted['stories'] = $db->query('DELETE FROM stories WHERE expires_at < NOW()')->rowCount();

        // 2) Jetons OTP expirés ou consommés depuis plus de 24 h.
        $deleted['auth_tokens'] = $db->query(
            'DELETE FROM auth_tokens WHERE expires_at < NOW()
             OR (consumed_at IS NOT NULL AND consumed_at < DATE_SUB(NOW(), INTERVAL 1 DAY))'
        )->rowCount();

        // 3) Sessions inactives depuis plus de 30 jours.
        $cutoff = time() - 30 * 86400;
        $stmt = $db->prepare('DELETE FROM sessions WHERE last_activity < ?');
        $stmt->execute([$cutoff]);
        $deleted['sessions'] = $stmt->rowCount();

        // 4) Compteurs de rate-limit dont la fenêtre est terminée.
        $stmt = $db->prepare('DELETE FROM rate_limits WHERE reset_at < ?');
        $stmt->execute([time()]);
        $deleted['rate_limits'] = $stmt->rowCount();

        // 5) Notifications lues de plus de 90 jours (allègement).
        $deleted['notifications'] = $db->query(
            'DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
        )->rowCount();

        // 6) Messages supprimés (soft-delete) purgés définitivement après 30 jours.
        $deleted['messages'] = $db->query(
            'DELETE FROM messages WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
        )->rowCount();

        // 7) Messages éphémères expirés (suppression définitive).
        $deleted['ephemeral'] = $db->query(
            'DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        )->rowCount();

        // 8) File d'envoi : messages déjà livrés depuis plus de 30 jours.
        $deleted['outbox'] = (new \Amoura\Models\Outbox())->purgeSent(30);

        return $deleted;
    }
}

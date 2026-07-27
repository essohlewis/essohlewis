<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Événements & communautés (Phase 5, Sprint +17).
 * Inscription atomique avec capacité et liste d'attente ; libération d'une place
 * promeut automatiquement le premier inscrit en attente.
 */
final class Event extends Model
{
    protected string $table = 'events';

    /** Événements publiés à venir, avec le nombre d'inscrits confirmés. */
    public function upcoming(int $limit = 30): array
    {
        return $this->run(
            "SELECT e.*,
                    (SELECT COUNT(*) FROM event_attendees a
                      WHERE a.event_id = e.id AND a.status = 'going') AS going_count
             FROM events e
             WHERE e.status = 'published' AND e.starts_at > NOW()
             ORDER BY e.starts_at ASC LIMIT ?",
            [$limit]
        )->fetchAll();
    }

    /** Événement par slug (avec compteur d'inscrits), ou null. */
    public function bySlug(string $slug): ?array
    {
        $row = $this->run(
            "SELECT e.*,
                    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id AND a.status = 'going') AS going_count,
                    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id AND a.status = 'waitlist') AS waitlist_count
             FROM events e WHERE e.slug = ? LIMIT 1",
            [$slug]
        )->fetch();
        return $row ?: null;
    }

    /** Statut d'inscription d'un membre (going|waitlist|canceled) ou null. */
    public function attendeeStatus(int $eventId, int $userId): ?string
    {
        $s = $this->run(
            'SELECT status FROM event_attendees WHERE event_id = ? AND user_id = ?',
            [$eventId, $userId]
        )->fetchColumn();
        return $s !== false ? (string) $s : null;
    }

    /**
     * Inscrit un membre à un événement, atomiquement.
     * Renvoie 'going', 'waitlist', ou null si l'inscription est impossible
     * (événement absent, non publié ou déjà passé).
     */
    public function join(int $eventId, int $userId): ?string
    {
        return $this->transaction(function ($db) use ($eventId, $userId): ?string {
            $st = $db->prepare('SELECT capacity, status, starts_at FROM events WHERE id = ? FOR UPDATE');
            $st->execute([$eventId]);
            $event = $st->fetch();
            if (!$event || $event['status'] !== 'published' || strtotime((string) $event['starts_at']) <= time()) {
                return null;
            }

            // Déjà inscrit et actif ? On renvoie son statut sans doublon.
            $cur = $db->prepare('SELECT status FROM event_attendees WHERE event_id = ? AND user_id = ?');
            $cur->execute([$eventId, $userId]);
            $existing = $cur->fetchColumn();
            if ($existing === 'going' || $existing === 'waitlist') {
                return (string) $existing;
            }

            // Place disponible ? (capacité NULL = illimité).
            $goingStmt = $db->prepare("SELECT COUNT(*) FROM event_attendees WHERE event_id = ? AND status = 'going'");
            $goingStmt->execute([$eventId]);
            $going = (int) $goingStmt->fetchColumn();
            $capacity = $event['capacity'] !== null ? (int) $event['capacity'] : null;
            $newStatus = ($capacity === null || $going < $capacity) ? 'going' : 'waitlist';

            $db->prepare(
                'INSERT INTO event_attendees (event_id, user_id, status, joined_at)
                 VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE status = VALUES(status), joined_at = NOW()'
            )->execute([$eventId, $userId, $newStatus]);

            return $newStatus;
        });
    }

    /**
     * Désinscrit un membre. Si une place « going » se libère et qu'une liste
     * d'attente existe, promeut le plus ancien en attente.
     * @return array{left:bool, promoted_user_id:?int}
     */
    public function leave(int $eventId, int $userId): array
    {
        return $this->transaction(function ($db) use ($eventId, $userId): array {
            $st = $db->prepare('SELECT status FROM event_attendees WHERE event_id = ? AND user_id = ? FOR UPDATE');
            $st->execute([$eventId, $userId]);
            $status = $st->fetchColumn();
            if ($status === false || $status === 'canceled') {
                return ['left' => false, 'promoted_user_id' => null];
            }

            $db->prepare("UPDATE event_attendees SET status = 'canceled' WHERE event_id = ? AND user_id = ?")
               ->execute([$eventId, $userId]);

            // Une place confirmée se libère → promeut le premier en attente.
            $promoted = null;
            if ($status === 'going') {
                $next = $db->prepare(
                    "SELECT user_id FROM event_attendees
                     WHERE event_id = ? AND status = 'waitlist'
                     ORDER BY joined_at ASC LIMIT 1 FOR UPDATE"
                );
                $next->execute([$eventId]);
                $nextId = $next->fetchColumn();
                if ($nextId !== false) {
                    $db->prepare("UPDATE event_attendees SET status = 'going' WHERE event_id = ? AND user_id = ?")
                       ->execute([$eventId, (int) $nextId]);
                    $promoted = (int) $nextId;
                }
            }

            return ['left' => true, 'promoted_user_id' => $promoted];
        });
    }

    /** Événements auxquels un membre est inscrit (à venir). */
    public function forUser(int $userId): array
    {
        return $this->run(
            "SELECT e.*, a.status AS attendee_status
             FROM event_attendees a JOIN events e ON e.id = a.event_id
             WHERE a.user_id = ? AND a.status IN ('going','waitlist') AND e.starts_at > NOW()
             ORDER BY e.starts_at ASC",
            [$userId]
        )->fetchAll();
    }

    /** Liste d'administration (tous statuts). */
    public function forAdmin(int $limit = 100): array
    {
        return $this->run(
            "SELECT e.*,
                    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id AND a.status = 'going') AS going_count
             FROM events e ORDER BY e.starts_at DESC LIMIT ?",
            [$limit]
        )->fetchAll();
    }
}

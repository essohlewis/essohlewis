<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Gère les actions like/pass/superlike et la création atomique des matchs.
 */
final class Swipe extends Model
{
    protected string $table = 'swipes';

    /**
     * Enregistre une action et détermine s'il y a match mutuel.
     * Opération transactionnelle avec verrouillage pour éviter les doubles matchs.
     *
     * @return array{matched:bool, match_id:?int, conversation_id:?int}
     */
    public function act(int $actorId, int $targetId, string $action): array
    {
        if ($actorId === $targetId) {
            throw new \InvalidArgumentException('Action sur soi-même impossible.');
        }

        return $this->transaction(function ($db) use ($actorId, $targetId, $action) {
            // Enregistre/écrase le swipe de l'acteur.
            $db->prepare(
                'INSERT INTO swipes (actor_id, target_id, action) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE action = VALUES(action), created_at = NOW()'
            )->execute([$actorId, $targetId, $action]);

            $result = ['matched' => false, 'match_id' => null, 'conversation_id' => null];

            if ($action === 'pass') {
                return $result;
            }

            // La cible a-t-elle déjà liké l'acteur ? (verrou de ligne)
            $stmt = $db->prepare(
                'SELECT action FROM swipes
                 WHERE actor_id = ? AND target_id = ? AND action IN ("like","superlike")
                 FOR UPDATE'
            );
            $stmt->execute([$targetId, $actorId]);
            if ($stmt->fetch() === false) {
                return $result; // pas encore réciproque
            }

            // Match mutuel : crée la paire ordonnée (lo, hi) de manière idempotente.
            $lo = min($actorId, $targetId);
            $hi = max($actorId, $targetId);
            $db->prepare(
                'INSERT INTO matches (user_lo, user_hi) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE status = "active"'
            )->execute([$lo, $hi]);

            $matchId = (int) $db->query(
                "SELECT id FROM matches WHERE user_lo = {$lo} AND user_hi = {$hi}"
            )->fetchColumn();

            // Crée la conversation associée si absente.
            $conv = $db->prepare('SELECT id FROM conversations WHERE match_id = ?');
            $conv->execute([$matchId]);
            $conversationId = $conv->fetchColumn();
            if ($conversationId === false) {
                $db->prepare('INSERT INTO conversations (match_id) VALUES (?)')->execute([$matchId]);
                $conversationId = (int) $db->lastInsertId();
                $ins = $db->prepare('INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
                $ins->execute([$conversationId, $lo]);
                $ins->execute([$conversationId, $hi]);
            }

            return [
                'matched' => true,
                'match_id' => $matchId,
                'conversation_id' => (int) $conversationId,
            ];
        });
    }

    public function likesReceivedCount(int $userId): int
    {
        return (int) $this->run(
            'SELECT COUNT(*) FROM swipes WHERE target_id = ? AND action IN ("like","superlike")',
            [$userId]
        )->fetchColumn();
    }

    /** Nombre de likes émis aujourd'hui (pour le quota du plan gratuit). */
    public function likesTodayCount(int $userId): int
    {
        return (int) $this->run(
            'SELECT COUNT(*) FROM swipes
             WHERE actor_id = ? AND action IN ("like","superlike") AND DATE(created_at) = CURDATE()',
            [$userId]
        )->fetchColumn();
    }

    /** Profils qui ont liké l'utilisateur (fonctionnalité Premium « qui m'a liké »). */
    public function admirers(int $userId, int $limit = 30): array
    {
        return $this->run(
            'SELECT u.id, u.display_name, u.birthdate, ph.path AS avatar_path, s.action, s.created_at
             FROM swipes s
             JOIN users u ON u.id = s.actor_id
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE s.target_id = ? AND s.action IN ("like","superlike")
               AND NOT EXISTS (SELECT 1 FROM swipes s2 WHERE s2.actor_id = ? AND s2.target_id = s.actor_id)
             ORDER BY s.created_at DESC LIMIT ?',
            [$userId, $userId, $limit]
        )->fetchAll();
    }

    /**
     * Décisions récentes d'un membre avec les caractéristiques des profils ciblés,
     * pour l'apprentissage des préférences (matching ML v1, Sprint +15).
     * @return array<int,array{action:string,birthdate:?string,is_verified:int,interests:?string,city:?string,country:?string}>
     */
    public function decisionsFor(int $userId, int $limit = 200): array
    {
        return $this->run(
            'SELECT s.action, u.birthdate, u.is_verified, p.interests, p.city, p.country
             FROM swipes s
             JOIN users u ON u.id = s.target_id
             LEFT JOIN profiles p ON p.user_id = s.target_id
             WHERE s.actor_id = ? AND s.action IN ("like","superlike","pass")
             ORDER BY s.id DESC LIMIT ?',
            [$userId, $limit]
        )->fetchAll();
    }
}

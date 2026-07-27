<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Demandes de vérification de profil par selfie (Phase 4, Sprint +10).
 * Une soumission crée une demande « pending » pré-notée automatiquement ; un
 * membre du staff tranche (approuve → badge vérifié, ou rejette).
 */
final class Verification extends Model
{
    protected string $table = 'verification_requests';

    /** Crée une demande de vérification et renvoie son id. */
    public function submit(int $userId, string $selfiePath, ?int $autoScore = null): int
    {
        return $this->create([
            'user_id' => $userId,
            'selfie_path' => $selfiePath,
            'auto_score' => $autoScore,
            'status' => 'pending',
        ]);
    }

    /** Dernière demande d'un utilisateur (pour afficher son statut). */
    public function latestFor(int $userId): ?array
    {
        $row = $this->run(
            'SELECT * FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [$userId]
        )->fetch();
        return $row ?: null;
    }

    /** Vrai si l'utilisateur a déjà une demande en attente (évite les doublons). */
    public function hasPending(int $userId): bool
    {
        return (bool) $this->run(
            'SELECT 1 FROM verification_requests WHERE user_id = ? AND status = "pending" LIMIT 1',
            [$userId]
        )->fetchColumn();
    }

    /** File de revue : demandes en attente, les mieux notées d'abord. */
    public function queue(int $limit = 50): array
    {
        return $this->run(
            'SELECT v.*, u.display_name, u.email
             FROM verification_requests v
             JOIN users u ON u.id = v.user_id
             WHERE v.status = "pending"
             ORDER BY v.auto_score DESC, v.created_at ASC
             LIMIT ?',
            [$limit]
        )->fetchAll();
    }

    /**
     * Tranche une demande de façon atomique : marque la demande ET, si approuvée,
     * pose le badge vérifié sur l'utilisateur. Renvoie l'id utilisateur concerné.
     */
    public function decide(int $requestId, int $staffId, bool $approve): ?int
    {
        return $this->transaction(function ($db) use ($requestId, $staffId, $approve): ?int {
            $st = $db->prepare('SELECT user_id, status FROM verification_requests WHERE id = ? FOR UPDATE');
            $st->execute([$requestId]);
            $req = $st->fetch();
            if (!$req || $req['status'] !== 'pending') {
                return null; // déjà traitée ou inexistante (idempotent)
            }
            $userId = (int) $req['user_id'];

            $db->prepare('UPDATE verification_requests SET status = ?, handled_by = ?, handled_at = NOW() WHERE id = ?')
               ->execute([$approve ? 'approved' : 'rejected', $staffId, $requestId]);

            if ($approve) {
                $db->prepare('UPDATE users SET is_verified = 1 WHERE id = ?')->execute([$userId]);
            }
            return $userId;
        });
    }
}

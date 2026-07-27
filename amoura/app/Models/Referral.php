<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Programme de parrainage (Phase 5, Sprint +12).
 * Chaque membre a un code unique ; quand un filleul vérifie son compte, le
 * parrain (et le filleul) reçoivent des crédits Super Like.
 */
final class Referral extends Model
{
    protected string $table = 'referrals';

    /** Récompenses (en crédits Super Like). */
    public const REWARD_ITEM = 'superlike';
    public const REFERRER_REWARD = 5;   // pour le parrain, à la qualification du filleul
    public const REFEREE_BONUS   = 3;   // bonus de bienvenue pour le filleul

    /**
     * Renvoie le code de parrainage d'un utilisateur, en le générant (unique) si
     * besoin. Persisté dans users.referral_code.
     */
    public function codeFor(int $userId): string
    {
        $existing = $this->run('SELECT referral_code FROM users WHERE id = ?', [$userId])->fetchColumn();
        if (is_string($existing) && $existing !== '') {
            return $existing;
        }
        $code = $this->generateUniqueCode();
        $this->run('UPDATE users SET referral_code = ? WHERE id = ?', [$code, $userId]);
        return $code;
    }

    /** Génère un code court non ambigu et vérifie son unicité. */
    private function generateUniqueCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I,O,0,1 (lisibilité)
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $taken = $this->run('SELECT 1 FROM users WHERE referral_code = ? LIMIT 1', [$code])->fetchColumn();
        } while ($taken);
        return $code;
    }

    /** Utilisateur propriétaire d'un code (parrain potentiel), sinon null. */
    public function referrerByCode(string $code): ?int
    {
        $id = $this->run('SELECT id FROM users WHERE referral_code = ? LIMIT 1', [strtoupper(trim($code))])->fetchColumn();
        return $id !== false ? (int) $id : null;
    }

    /**
     * Enregistre un parrainage à l'inscription (statut « pending »).
     * Ignore l'auto-parrainage et les doublons (un filleul n'est parrainé qu'une fois).
     * @return bool true si un parrainage a été créé.
     */
    public function record(string $code, int $referredId): bool
    {
        $referrerId = $this->referrerByCode($code);
        if ($referrerId === null || $referrerId === $referredId) {
            return false;
        }
        try {
            $this->run(
                'INSERT INTO referrals (referrer_id, referred_id, code) VALUES (?, ?, ?)',
                [$referrerId, $referredId, strtoupper(trim($code))]
            );
            return true;
        } catch (\PDOException) {
            return false; // filleul déjà parrainé (clé unique)
        }
    }

    /**
     * Qualifie le parrainage d'un filleul (à sa vérification) : crédite le parrain
     * et le filleul, une seule fois. Renvoie l'id du parrain récompensé, sinon null.
     */
    public function qualify(int $referredId): ?int
    {
        return $this->transaction(function ($db) use ($referredId): ?int {
            $st = $db->prepare('SELECT id, referrer_id, status FROM referrals WHERE referred_id = ? FOR UPDATE');
            $st->execute([$referredId]);
            $ref = $st->fetch();
            if (!$ref || $ref['status'] !== 'pending') {
                return null; // pas de parrainage, ou déjà récompensé (idempotent)
            }
            $referrerId = (int) $ref['referrer_id'];

            $db->prepare('UPDATE referrals SET status = "rewarded", reward_credits = ?, rewarded_at = NOW() WHERE id = ?')
               ->execute([self::REFERRER_REWARD, (int) $ref['id']]);

            $credit = new Credit();
            $credit->grant($referrerId, self::REWARD_ITEM, self::REFERRER_REWARD);
            $credit->grant($referredId, self::REWARD_ITEM, self::REFEREE_BONUS);
            return $referrerId;
        });
    }

    /** Statistiques de parrainage d'un utilisateur (pour la page « inviter »). */
    public function statsFor(int $userId): array
    {
        $row = $this->run(
            'SELECT COUNT(*) AS invited,
                    SUM(status = "rewarded") AS rewarded,
                    COALESCE(SUM(reward_credits), 0) AS credits_earned
             FROM referrals WHERE referrer_id = ?',
            [$userId]
        )->fetch();
        return [
            'invited' => (int) ($row['invited'] ?? 0),
            'rewarded' => (int) ($row['rewarded'] ?? 0),
            'credits_earned' => (int) ($row['credits_earned'] ?? 0),
        ];
    }
}

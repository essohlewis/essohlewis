<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Agent indépendant du réseau Transouscris : dispose d'un compte de flotte
 * (float) au grand livre, d'un statut de disponibilité, d'une note moyenne et
 * d'un score de fiabilité calculé sur l'historique de ses recharges.
 */
final class Agent extends Model
{
    protected static string $table = 'agents';

    public ?int $id = null;
    public int $userId = 0;
    public string $code = '';
    public string $displayName = '';
    public ?string $zone = null;
    public bool $isAvailable = false;
    public float $ratingAvg = 0.0;
    public int $ratingCount = 0;
    public float $reliabilityScore = 100.0; // 0–100
    public ?int $floatAccountId = null;
    public string $status = 'active';       // active | suspended
    public ?string $createdAt = null;

    /** @return self[] agents disponibles, triés par fiabilité puis note. */
    public static function available(?string $zone = null): array
    {
        $sql = "SELECT * FROM agents WHERE status = 'active' AND is_available = 1";
        $params = [];
        if ($zone !== null) {
            $sql .= ' AND zone = :zone';
            $params['zone'] = $zone;
        }
        $sql .= ' ORDER BY reliability_score DESC, rating_avg DESC';
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    public function setAvailability(bool $available): void
    {
        self::pdo()->prepare('UPDATE agents SET is_available = :a WHERE id = :id')
            ->execute(['a' => $available ? 1 : 0, 'id' => $this->id]);
        $this->isAvailable = $available;
    }

    /**
     * Enregistre une note (1–5) et recalcule la moyenne de façon incrémentale.
     */
    public function addRating(int $stars): void
    {
        $newCount = $this->ratingCount + 1;
        $newAvg   = (($this->ratingAvg * $this->ratingCount) + $stars) / $newCount;
        self::pdo()->prepare(
            'UPDATE agents SET rating_avg = :avg, rating_count = :cnt WHERE id = :id'
        )->execute(['avg' => round($newAvg, 2), 'cnt' => $newCount, 'id' => $this->id]);
        $this->ratingAvg   = round($newAvg, 2);
        $this->ratingCount = $newCount;
    }
}

<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Numéro favori enregistré par l'utilisateur (Moi, Famille, Conjoint, Enfants,
 * Amis...), sélectionnable en un clic dans les parcours de recharge/transfert.
 */
final class Favorite extends Model
{
    protected static string $table = 'favorites';

    public ?int $id = null;
    public int $userId = 0;
    public string $label = '';
    public string $relation = 'autre';   // moi | famille | conjoint | enfants | amis | autre
    public string $msisdn = '';
    public ?string $operatorCode = null;
    public ?string $createdAt = null;

    /** @return self[] */
    public static function forUser(int $userId): array
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM favorites WHERE user_id = :uid ORDER BY relation, label'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }

    /**
     * Ajoute ou met à jour un favori (unicité sur user_id + msisdn).
     */
    public static function upsert(int $userId, string $label, string $relation, string $msisdn, ?string $operatorCode): self
    {
        self::pdo()->prepare(
            'INSERT INTO favorites (user_id, label, relation, msisdn, operator_code, created_at)
             VALUES (:uid, :label, :rel, :msisdn, :op, NOW())
             ON DUPLICATE KEY UPDATE label = VALUES(label), relation = VALUES(relation), operator_code = VALUES(operator_code)'
        )->execute([
            'uid'    => $userId,
            'label'  => $label,
            'rel'    => $relation,
            'msisdn' => $msisdn,
            'op'     => $operatorCode,
        ]);
        $stmt = self::pdo()->prepare('SELECT * FROM favorites WHERE user_id = :uid AND msisdn = :m LIMIT 1');
        $stmt->execute(['uid' => $userId, 'm' => $msisdn]);
        $row = $stmt->fetch();
        return $row ? self::hydrate($row) : self::find((int) self::pdo()->lastInsertId());
    }

    public function delete(): void
    {
        self::pdo()->prepare('DELETE FROM favorites WHERE id = :id')->execute(['id' => $this->id]);
    }

    public function relationIcon(): string
    {
        return match ($this->relation) {
            'moi'      => '📱',
            'famille'  => '👪',
            'conjoint' => '❤️',
            'enfants'  => '🧒',
            'amis'     => '🤝',
            default    => '⭐',
        };
    }
}

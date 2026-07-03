<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Forfait opérateur (internet, appel, SMS, mixte).
 */
final class Plan extends Model
{
    protected static string $table = 'plans';

    public ?int $id = null;
    public string $operatorCode = '';
    public string $code = '';
    public string $name = '';
    public string $category = 'internet';  // internet | voice | sms | mixte
    public ?string $subcategory = null;    // illimite | jour | semaine | quinzaine | mois | nuit | special
    public int $price = 0;                 // unités mineures
    public ?string $validity = null;       // ex: "30 jours"
    public ?string $dataVolume = null;     // ex: "1 Go", "Illimité"
    public ?string $description = null;
    public bool $active = true;

    /** @return self[] */
    public static function forOperator(string $operatorCode): array
    {
        $stmt = self::pdo()->prepare(
            'SELECT * FROM plans WHERE operator_code = :op AND active = 1 ORDER BY price ASC'
        );
        $stmt->execute(['op' => $operatorCode]);
        return array_map(static fn ($r) => self::hydrate($r), $stmt->fetchAll());
    }
}

<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Coupons de réduction (abonnements & achats) — Sprint +6. */
final class Coupon extends Model
{
    protected string $table = 'coupons';

    /** Coupon valide et utilisable pour le code donné, sinon null. */
    public function valid(string $code): ?array
    {
        $row = $this->run(
            'SELECT * FROM coupons
             WHERE code = ? AND is_active = 1
               AND (expires_at IS NULL OR expires_at > NOW())
               AND (max_redemptions IS NULL OR redeemed < max_redemptions)
             LIMIT 1',
            [strtoupper(trim($code))]
        )->fetch();
        return $row ?: null;
    }

    /** Applique la réduction d'un coupon à un montant (centimes), plancher 0. */
    public static function apply(array $coupon, int $amountCents): int
    {
        if (!empty($coupon['percent_off'])) {
            $amountCents -= (int) round($amountCents * (int) $coupon['percent_off'] / 100);
        } elseif (!empty($coupon['amount_off'])) {
            $amountCents -= (int) $coupon['amount_off'];
        }
        return max(0, $amountCents);
    }

    /** Incrémente le compteur de rachats de façon atomique (respecte le plafond). */
    public function redeem(int $couponId): bool
    {
        return $this->run(
            'UPDATE coupons SET redeemed = redeemed + 1
             WHERE id = ? AND (max_redemptions IS NULL OR redeemed < max_redemptions)',
            [$couponId]
        )->rowCount() > 0;
    }
}

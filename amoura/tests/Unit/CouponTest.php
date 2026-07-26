<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Models\Coupon;
use PHPUnit\Framework\TestCase;

/** Calcul de réduction des coupons — logique pure (Sprint +6). */
final class CouponTest extends TestCase
{
    public function testPercentOff(): void
    {
        // 25 % de 1000 centimes = 750.
        $this->assertSame(750, Coupon::apply(['percent_off' => 25], 1000));
    }

    public function testAmountOff(): void
    {
        $this->assertSame(700, Coupon::apply(['amount_off' => 300], 1000));
    }

    public function testFloorAtZero(): void
    {
        // Une remise supérieure au montant ne descend jamais sous 0.
        $this->assertSame(0, Coupon::apply(['amount_off' => 5000], 1000));
        $this->assertSame(0, Coupon::apply(['percent_off' => 100], 1000));
    }

    public function testNoDiscountLeavesAmount(): void
    {
        $this->assertSame(1000, Coupon::apply([], 1000));
    }

    public function testPercentTakesPrecedenceOverAmount(): void
    {
        // percent_off est prioritaire s'il est présent.
        $this->assertSame(900, Coupon::apply(['percent_off' => 10, 'amount_off' => 500], 1000));
    }
}

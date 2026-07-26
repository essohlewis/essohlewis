<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Security\Validator;
use PHPUnit\Framework\TestCase;

final class ValidatorTest extends TestCase
{
    public function testRequiredAndEmailRules(): void
    {
        $v = (new Validator(['email' => '']))->require('email')->email('email');
        $this->assertTrue($v->fails());
    }

    public function testValidPayloadPasses(): void
    {
        $v = (new Validator(['email' => 'a@b.io', 'pw' => 'abcd1234']))
            ->require('email')->email('email')->strongPassword('pw');
        $this->assertTrue($v->passes());
        $this->assertNull($v->firstError());
    }

    public function testStrongPasswordRequiresLettersAndDigits(): void
    {
        $this->assertTrue((new Validator(['pw' => 'onlyletters'])->strongPassword('pw'))->fails());
        $this->assertTrue((new Validator(['pw' => '12345678'])->strongPassword('pw'))->fails());
        $this->assertTrue((new Validator(['pw' => 'abc12'])->strongPassword('pw'))->fails());
        $this->assertTrue((new Validator(['pw' => 'abcd1234'])->strongPassword('pw'))->passes());
    }

    public function testMinAgeEnforced(): void
    {
        $under = date('Y-m-d', strtotime('-16 years'));
        $over = date('Y-m-d', strtotime('-25 years'));
        $this->assertTrue((new Validator(['dob' => $under])->minAge('dob', 18))->fails());
        $this->assertTrue((new Validator(['dob' => $over])->minAge('dob', 18))->passes());
    }

    public function testInAndMatchesRules(): void
    {
        $this->assertTrue((new Validator(['g' => 'x'])->in('g', ['male', 'female']))->fails());
        $this->assertTrue((new Validator(['a' => '1', 'b' => '2'])->matches('a', 'b'))->fails());
        $this->assertTrue((new Validator(['a' => '1', 'b' => '1'])->matches('a', 'b'))->passes());
    }
}

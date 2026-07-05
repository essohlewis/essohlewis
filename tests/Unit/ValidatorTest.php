<?php

declare(strict_types=1);

namespace Transouscris\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Transouscris\Core\Exceptions\ValidationException;
use Transouscris\Core\Validator;

final class ValidatorTest extends TestCase
{
    public function test_valide_un_numero_ivoirien(): void
    {
        $data = Validator::make(['phone' => '0700000000'])->validate(['phone' => 'required|phone_ci']);
        $this->assertSame('0700000000', $data['phone']);
    }

    public function test_rejette_un_montant_negatif(): void
    {
        $this->expectException(ValidationException::class);
        Validator::make(['amount' => '-5'])->validate(['amount' => 'required|amount']);
    }

    public function test_expose_les_erreurs_par_champ(): void
    {
        try {
            Validator::make(['amount' => 'abc'])->validate(['amount' => 'required|amount']);
            $this->fail('Une ValidationException était attendue.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('amount', $e->errors());
        }
    }

    public function test_contrainte_in(): void
    {
        $this->expectException(ValidationException::class);
        Validator::make(['gateway' => 'inconnu'])->validate(['gateway' => 'required|in:cinetpay,paydunya']);
    }
}

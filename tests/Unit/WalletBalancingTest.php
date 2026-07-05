<?php

declare(strict_types=1);

namespace Transouscris\Tests\Unit;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Transouscris\Services\WalletService;

/**
 * Vérifie les invariants de la partie double qui sont contrôlés AVANT tout
 * accès base (donc testables sans MySQL). Les tests d'intégration avec verrou
 * pessimiste sont décrits dans docs/TESTING.md.
 */
final class WalletBalancingTest extends TestCase
{
    private WalletService $wallet;

    protected function setUp(): void
    {
        $this->wallet = new WalletService();
    }

    public function test_rejette_une_transaction_desequilibree(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/déséquilibrée/');

        // 1000 débité mais seulement 900 crédité → rejet immédiat.
        $this->wallet->post('ref-desequilibre', 'test', [
            ['account_id' => 1, 'direction' => 'debit',  'amount' => 1000],
            ['account_id' => 2, 'direction' => 'credit', 'amount' => 900],
        ]);
    }

    public function test_exige_au_moins_deux_ecritures(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/deux écritures/');

        $this->wallet->post('ref-une-seule', 'test', [
            ['account_id' => 1, 'direction' => 'debit', 'amount' => 1000],
        ]);
    }

    public function test_rejette_une_direction_invalide(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->wallet->post('ref-direction', 'test', [
            ['account_id' => 1, 'direction' => 'debit',   'amount' => 1000],
            ['account_id' => 2, 'direction' => 'invalide', 'amount' => 1000],
        ]);
    }
}

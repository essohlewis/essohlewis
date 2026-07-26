<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Portefeuille de crédits consommables d'un utilisateur (Sprint +5).
 * Types : boost, superlike, reveal.
 */
final class Credit extends Model
{
    protected string $table = 'user_credits';

    public function balance(int $userId, string $item): int
    {
        return (int) $this->run(
            'SELECT balance FROM user_credits WHERE user_id = ? AND item = ?',
            [$userId, $item]
        )->fetchColumn();
    }

    /** @return array<string,int> item => solde. Nommé `balances` (Model::all réservé). */
    public function balances(int $userId): array
    {
        $rows = $this->run('SELECT item, balance FROM user_credits WHERE user_id = ?', [$userId])->fetchAll();
        $out = ['boost' => 0, 'superlike' => 0, 'reveal' => 0];
        foreach ($rows as $r) {
            $out[$r['item']] = (int) $r['balance'];
        }
        return $out;
    }

    public function grant(int $userId, string $item, int $qty): void
    {
        $this->run(
            'INSERT INTO user_credits (user_id, item, balance) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)',
            [$userId, $item, $qty]
        );
    }

    /**
     * Consomme un crédit de façon atomique (verrou de ligne).
     * @return bool true si le crédit a été débité, false si solde insuffisant.
     */
    public function consume(int $userId, string $item, int $qty = 1): bool
    {
        return $this->transaction(function ($db) use ($userId, $item, $qty) {
            $stmt = $db->prepare('SELECT balance FROM user_credits WHERE user_id = ? AND item = ? FOR UPDATE');
            $stmt->execute([$userId, $item]);
            $balance = $stmt->fetchColumn();
            if ($balance === false || (int) $balance < $qty) {
                return false;
            }
            $db->prepare('UPDATE user_credits SET balance = balance - ? WHERE user_id = ? AND item = ?')
               ->execute([$qty, $userId, $item]);
            return true;
        });
    }
}

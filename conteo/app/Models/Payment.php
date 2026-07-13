<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class Payment extends Model
{
    protected string $table = 'payments';

    /** @return array<string,mixed>|null */
    public function findByReference(string $reference): ?array
    {
        return $this->findBy('reference', $reference);
    }

    /** Génère une référence de transaction unique côté serveur. */
    public static function newReference(): string
    {
        return 'CNT-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(6)));
    }

    /**
     * Marque une transaction comme vérifiée après re-vérification serveur.
     * @param array<string,mixed> $callback
     */
    public function markVerified(int $paymentId, string $status, ?string $providerTxId, array $callback): void
    {
        $stmt = $this->db()->prepare(
            'UPDATE payments
             SET status = ?, provider_tx_id = ?, verified_at = NOW(), raw_callback = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $status,
            $providerTxId,
            json_encode($callback, JSON_UNESCAPED_UNICODE),
            $paymentId,
        ]);
    }
}

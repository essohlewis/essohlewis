<?php

declare(strict_types=1);

namespace Transouscris\Models;

use Transouscris\Services\Payment\PaymentStatus;

/**
 * Intention de paiement : trace un paiement fournisseur du début à sa
 * confirmation. Sert de pivot d'idempotence entre le webhook et le crédit wallet.
 */
final class PaymentIntent extends Model
{
    protected static string $table = 'payment_intents';

    public ?int $id = null;
    public int $userId = 0;
    public string $reference = '';           // notre référence unique
    public string $gateway = '';
    public string $purpose = 'wallet_topup'; // wallet_topup | direct_recharge | pot_contribution
    public int $amount = 0;
    public string $currency = 'XOF';
    public string $status = 'pending';       // pending | paid | failed | expired | cancelled
    public ?string $providerTransactionId = null;
    public ?int $ledgerTransactionId = null;
    public ?string $metadata = null;
    public ?string $createdAt = null;
    public ?string $paidAt = null;

    public static function start(int $userId, string $gateway, string $purpose, int $amount, array $metadata = []): self
    {
        $reference = self::generateReference($purpose);
        self::pdo()->prepare(
            'INSERT INTO payment_intents (user_id, reference, gateway, purpose, amount, currency, status, metadata, created_at)
             VALUES (:uid, :ref, :gw, :purpose, :amount, :cur, :status, :meta, NOW())'
        )->execute([
            'uid'     => $userId,
            'ref'     => $reference,
            'gw'      => $gateway,
            'purpose' => $purpose,
            'amount'  => $amount,
            'cur'     => 'XOF',
            'status'  => 'pending',
            'meta'    => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);
        return self::find((int) self::pdo()->lastInsertId());
    }

    public static function findByReference(string $reference): ?self
    {
        return self::firstWhere('reference', $reference);
    }

    public function markPaid(?string $providerTxnId, ?int $ledgerTxnId): void
    {
        self::pdo()->prepare(
            "UPDATE payment_intents
             SET status = 'paid', provider_transaction_id = :ptid, ledger_transaction_id = :ltid, paid_at = NOW()
             WHERE id = :id"
        )->execute(['ptid' => $providerTxnId, 'ltid' => $ledgerTxnId, 'id' => $this->id]);
        $this->status = 'paid';
    }

    public function markStatus(PaymentStatus $status): void
    {
        self::pdo()->prepare('UPDATE payment_intents SET status = :s WHERE id = :id')
            ->execute(['s' => $status->value, 'id' => $this->id]);
        $this->status = $status->value;
    }

    public function metadataArray(): array
    {
        $decoded = json_decode($this->metadata ?? '[]', true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function generateReference(string $purpose): string
    {
        $prefix = match ($purpose) {
            'direct_recharge'   => 'RC',
            'pot_contribution'  => 'PT',
            default             => 'TP',
        };
        return $prefix . date('ymd') . strtoupper(bin2hex(random_bytes(5)));
    }
}

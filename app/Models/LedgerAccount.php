<?php

declare(strict_types=1);

namespace Transouscris\Models;

/**
 * Compte du grand livre (partie double). Représente aussi bien le portefeuille
 * d'un utilisateur/agent qu'un compte système (revenus, réserve cashback,
 * séquestre opérateur, passerelle externe).
 *
 * Les montants sont stockés en UNITÉS MINEURES (le XOF n'a pas de sous-unité en
 * pratique, mais on garde des entiers pour éviter toute erreur de flottant).
 *
 * Convention de solde : un compte d'actif utilisateur augmente au CRÉDIT.
 * Le WalletService applique la convention de manière cohérente ; ici, `balance`
 * est le solde disponible net (toujours ≥ 0 pour les comptes non système).
 */
final class LedgerAccount extends Model
{
    protected static string $table = 'ledger_accounts';

    public ?int $id = null;
    public string $ownerType = 'system';   // user | agent | system
    public ?int $ownerId = null;
    public ?string $code = null;           // renseigné pour les comptes système
    public string $type = 'liability';     // asset | liability | revenue | expense
    public string $currency = 'XOF';
    public int $balance = 0;               // solde en cache (unités mineures)
    public bool $allowNegative = false;    // les comptes système peuvent l'autoriser
    public string $status = 'active';

    /** Retourne le compte-portefeuille d'un utilisateur, en le créant si besoin. */
    public static function forUser(int $userId): self
    {
        $existing = self::pdo()->prepare(
            "SELECT * FROM ledger_accounts WHERE owner_type = 'user' AND owner_id = :uid LIMIT 1"
        );
        $existing->execute(['uid' => $userId]);
        $row = $existing->fetch();
        if ($row) {
            return self::hydrate($row);
        }

        self::pdo()->prepare(
            "INSERT INTO ledger_accounts (owner_type, owner_id, type, currency, balance, allow_negative, status)
             VALUES ('user', :uid, 'liability', 'XOF', 0, 0, 'active')"
        )->execute(['uid' => $userId]);

        return self::find((int) self::pdo()->lastInsertId());
    }

    /** Retourne un compte système par code (PLATFORM_REVENUE, GATEWAY_CLEARING, ...). */
    public static function system(string $code): self
    {
        $account = self::firstWhere('code', $code);
        if ($account === null) {
            throw new \RuntimeException("Compte système introuvable : $code");
        }
        return $account;
    }

    /** Solde formaté pour affichage (ex: 1 500 F CFA). */
    public function formattedBalance(): string
    {
        return number_format($this->balance, 0, ',', ' ') . ' F CFA';
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PackPurchase;
use App\Models\Subscription;

/**
 * Résout les droits d'accès : qui peut lire quoi.
 *
 * Règles :
 *  - Un conte gratuit (is_free) est accessible à tous.
 *  - Un abonnement actif débloque tout le catalogue + toutes les langues.
 *  - Un pack acheté débloque les contes de ce pack (accès à vie).
 */
final class EntitlementService
{
    public function __construct(
        private Subscription $subscriptions = new Subscription(),
        private PackPurchase $purchases = new PackPurchase(),
    ) {
    }

    public function hasActiveSubscription(int $userId): bool
    {
        return $this->subscriptions->activeForUser($userId) !== null;
    }

    /** @return int[] IDs de packs débloqués */
    public function unlockedPackIds(int $userId): array
    {
        return $this->purchases->paidPackIds($userId);
    }

    /**
     * L'utilisateur a-t-il accès à ce conte ?
     * @param array<string,mixed> $tale ligne de la table tales
     */
    public function canAccessTale(int $userId, array $tale): bool
    {
        if (!empty($tale['is_free'])) {
            return true;
        }
        if ($this->hasActiveSubscription($userId)) {
            return true;
        }
        $packId = $tale['pack_id'] ?? null;
        if ($packId !== null && in_array((int) $packId, $this->unlockedPackIds($userId), true)) {
            return true;
        }
        return false;
    }

    /**
     * L'utilisateur peut-il utiliser une langue de narration ?
     * Les langues autres que le français nécessitent un abonnement actif
     * ou la possession du pack contenant le conte.
     */
    public function canUseLang(int $userId, string $lang, array $tale): bool
    {
        if ($lang === 'fr') {
            return $this->canAccessTale($userId, $tale);
        }
        // Langues locales : réservées aux abonnés / propriétaires de pack.
        return $this->hasActiveSubscription($userId)
            || (isset($tale['pack_id']) && in_array((int) $tale['pack_id'], $this->unlockedPackIds($userId), true));
    }

    /**
     * Enrichit une ligne de conte avec le droit d'accès résolu.
     * @param array<string,mixed> $tale
     * @return array<string,mixed>
     */
    public function decorate(int $userId, array $tale): array
    {
        $tale['locked'] = !$this->canAccessTale($userId, $tale);
        return $tale;
    }
}

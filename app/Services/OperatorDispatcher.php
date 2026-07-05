<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Logger;

/**
 * Achemine une recharge vers l'opérateur (agrégateur airtime / API B2B).
 *
 * Implémentation de référence : simule un envoi asynchrone. En production, on
 * branche ici l'API de l'agrégateur (ex: CinetPay Transfer/Airtime, agrégateur
 * opérateur), puis la confirmation revient par webhook et met à jour la recharge.
 *
 * Le résultat `dispatched` ne signifie PAS « crédité » : la confirmation réelle
 * conditionne le passage au statut `success`. Sans confirmation dans le délai
 * imparti, la garantie de remboursement se déclenche (RefundGuaranteeService).
 */
final class OperatorDispatcher
{
    /**
     * @return array{accepted:bool, operator_ref:?string, error:?string}
     */
    public function dispatch(string $operatorCode, string $msisdn, int $amount, string $type, ?string $planCode = null): array
    {
        // Point d'intégration réel. Ici : acceptation optimiste + réf simulée.
        Logger::info('Dispatch recharge opérateur', compact('operatorCode', 'msisdn', 'amount', 'type', 'planCode'));

        return [
            'accepted'     => true,
            'operator_ref' => 'OP-' . strtoupper(bin2hex(random_bytes(6))),
            'error'        => null,
        ];
    }
}

<?php
/** @var \Transouscris\Models\Recharge[] $history */
$statusBadge = static function (string $s): string {
    return match ($s) {
        'success'  => 'bg-emerald-100 text-emerald-700',
        'refunded' => 'bg-amber-100 text-amber-700',
        'failed'   => 'bg-rose-100 text-rose-700',
        default    => 'bg-slate-100 text-slate-600',
    };
};
$typeLabel = static fn (string $t): string => match ($t) {
    'credit'   => 'Crédit',
    'internet' => 'Forfait internet',
    'voice'    => 'Forfait appels',
    'sms'      => 'Forfait SMS',
    default    => $t,
};
?>
<div class="space-y-4">
    <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">Historique des transactions</h1>
        <input id="hist-search" placeholder="Rechercher un numéro…" class="border rounded-lg px-3 py-1.5 text-sm">
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="text-left text-slate-400 border-b">
                <tr>
                    <th class="p-3">Date</th>
                    <th class="p-3">Opérateur</th>
                    <th class="p-3">Type</th>
                    <th class="p-3">Numéro</th>
                    <th class="p-3 text-right">Montant</th>
                    <th class="p-3">Statut</th>
                    <th class="p-3"></th>
                </tr>
            </thead>
            <tbody class="divide-y" id="hist-rows">
                <?php if (!$history): ?>
                    <tr><td colspan="7" class="p-4 text-slate-400">Aucune transaction.</td></tr>
                <?php else: foreach ($history as $r): ?>
                    <tr data-num="<?= e($r->msisdn) ?>">
                        <td class="p-3 text-slate-500 whitespace-nowrap"><?= e($r->createdAt) ?></td>
                        <td class="p-3"><?= e(strtoupper($r->operatorCode)) ?></td>
                        <td class="p-3"><?= e($typeLabel($r->type)) ?></td>
                        <td class="p-3 font-mono"><?= e($r->msisdn) ?></td>
                        <td class="p-3 text-right font-semibold"><?= money($r->amount) ?></td>
                        <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full <?= $statusBadge($r->status) ?>"><?= e($r->status) ?></span></td>
                        <td class="p-3 text-right whitespace-nowrap">
                            <a href="/recharge?operator=<?= e($r->operatorCode) ?>&type=<?= e($r->type) ?>&phone=<?= e($r->msisdn) ?><?= $r->type === 'credit' ? '&amount=' . (int) $r->amount : '' ?>"
                               class="text-xs bg-slate-800 text-white rounded px-2 py-1">↻ Refaire</a>
                            <a href="/recharge/<?= (int) $r->id ?>/receipt" class="text-xs text-teal-700 underline ml-1">Reçu</a>
                        </td>
                    </tr>
                <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
</div>

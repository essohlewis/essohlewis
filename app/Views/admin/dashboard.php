<?php /** @var array $stats */ ?>
<h1 class="text-2xl font-bold mb-6">Tableau de bord</h1>

<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <?php
    $cards = [
        ['Utilisateurs', $stats['users'], ''],
        ['Agents', $stats['agents'], ''],
        ['Recharges réussies', $stats['recharges_ok'], ''],
        ['Recharges en attente', $stats['recharges_pend'], ''],
        ['Volume rechargé', money((int) $stats['volume_xof']), ''],
        ['Encours portefeuilles', money((int) $stats['wallet_total']), ''],
    ];
    foreach ($cards as [$label, $value]): ?>
        <div class="bg-white rounded-xl shadow-sm p-5">
            <div class="text-sm text-slate-500"><?= e($label) ?></div>
            <div class="text-2xl font-bold mt-1"><?= e($value) ?></div>
        </div>
    <?php endforeach; ?>
</div>

<div class="mt-6 rounded-xl p-5 <?= (int) $stats['ledger_balance_check'] === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800' ?>">
    <div class="font-semibold">Contrôle d'intégrité comptable</div>
    <p class="text-sm mt-1">
        Somme de tous les soldes du grand livre :
        <strong><?= money((int) $stats['ledger_balance_check']) ?></strong>.
        <?= (int) $stats['ledger_balance_check'] === 0
            ? 'Grand livre équilibré ✔' : '⚠️ Déséquilibre détecté — audit requis.' ?>
    </p>
</div>

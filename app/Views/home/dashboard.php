<?php
/** @var \Transouscris\Models\LedgerAccount $wallet */
/** @var \Transouscris\Models\Recharge[] $recent */
?>
<div class="space-y-6">
    <div class="bg-gradient-to-br from-teal-700 to-teal-600 text-white rounded-2xl p-6 shadow">
        <div class="text-sm opacity-80">Solde du portefeuille</div>
        <div class="text-3xl font-extrabold mt-1"><?= e($wallet->formattedBalance()) ?></div>
        <div class="mt-4 flex gap-3">
            <a href="/wallet" class="bg-white/20 rounded-lg px-4 py-2 text-sm">Approvisionner</a>
            <a href="/recharge" class="bg-white text-teal-700 rounded-lg px-4 py-2 text-sm font-semibold">Recharger</a>
        </div>
    </div>

    <div>
        <h2 class="font-semibold text-slate-900 mb-2">Recharges récentes</h2>
        <div class="bg-white rounded-xl shadow-sm divide-y">
            <?php if (!$recent): ?>
                <p class="p-4 text-sm text-slate-500">Aucune recharge pour l'instant.</p>
            <?php else: foreach ($recent as $r): ?>
                <a href="/recharge/<?= (int) $r->id ?>/receipt" class="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div>
                        <div class="font-medium"><?= e($r->msisdn) ?> · <?= e(strtoupper($r->operatorCode)) ?></div>
                        <div class="text-xs text-slate-500"><?= e($r->createdAt) ?> · <?= e($r->type) ?></div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold"><?= money($r->amount) ?></div>
                        <span class="text-xs px-2 py-0.5 rounded-full <?= $r->status === 'success' ? 'bg-emerald-100 text-emerald-700' : ($r->status === 'refunded' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600') ?>">
                            <?= e($r->status) ?>
                        </span>
                    </div>
                </a>
            <?php endforeach; endif; ?>
        </div>
    </div>
</div>

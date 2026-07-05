<?php /** @var \Transouscris\Models\Agent[] $agents */ ?>
<h1 class="text-xl font-bold mb-4">Agents disponibles</h1>
<div class="grid sm:grid-cols-2 gap-4">
    <?php foreach ($agents as $a): ?>
        <div class="bg-white rounded-xl shadow-sm p-4">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-semibold"><?= e($a->displayName) ?></div>
                    <div class="text-xs text-slate-500"><?= e($a->zone ?? 'Zone non précisée') ?></div>
                </div>
                <span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Disponible</span>
            </div>
            <div class="mt-3 flex items-center gap-4 text-sm">
                <span title="Note">⭐ <?= number_format($a->ratingAvg, 1) ?> (<?= (int) $a->ratingCount ?>)</span>
                <span title="Fiabilité">🛡️ <?= (int) $a->reliabilityScore ?>%</span>
            </div>
        </div>
    <?php endforeach; ?>
    <?php if (!$agents): ?>
        <p class="text-slate-500">Aucun agent disponible pour le moment.</p>
    <?php endif; ?>
</div>

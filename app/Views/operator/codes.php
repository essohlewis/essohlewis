<?php
/** @var array $operators */
/** @var array $labels */
?>
<div class="space-y-4">
    <div>
        <h1 class="text-xl font-bold">Codes utiles</h1>
        <p class="text-sm text-slate-500">Codes USSD officiels des opérateurs (à composer depuis votre téléphone).</p>
    </div>

    <div class="grid md:grid-cols-3 gap-4">
        <?php foreach ($operators as $op): ?>
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div class="px-4 py-3 text-white font-bold" style="background: <?= e($op['color']) ?>">
                    <?= e($op['name']) ?>
                </div>
                <div class="p-4 space-y-2">
                    <?php foreach ($op['ussd'] as $key => $code): ?>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-sm text-slate-600"><?= e($labels[$key] ?? ucfirst($key)) ?></span>
                            <code class="text-sm font-mono bg-slate-100 rounded px-2 py-0.5 whitespace-nowrap"><?= e($code) ?></code>
                        </div>
                    <?php endforeach; ?>
                    <?php if (!empty($op['rules'])): ?>
                        <div class="pt-2 mt-2 border-t text-xs text-slate-500">
                            Transfert : <?= !empty($op['rules']['transfer_enabled']) ? 'autorisé' : 'indisponible' ?>
                            (<?= money((int) $op['rules']['transfer_min']) ?>–<?= money((int) $op['rules']['transfer_max']) ?>)
                            <?php if (!empty($op['rules']['bonus_days'])): ?>
                                · Bonus : <?= e(implode(', ', $op['rules']['bonus_days'])) ?>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($op['app'])): ?>
                        <div class="text-xs text-slate-400">Appli : <?= e($op['app']) ?></div>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>

    <p class="text-xs text-slate-400">
        Codes indicatifs (sources : sites officiels des opérateurs) — susceptibles d'évoluer.
    </p>
</div>

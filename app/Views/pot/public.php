<?php
/** @var \Transouscris\Models\Pot $pot */
/** @var string[] $gateways */
?>
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6">
    <h1 class="text-xl font-bold"><?= e($pot->title) ?></h1>
    <p class="text-sm text-slate-500 mt-1">Cagnotte pour recharger <?= e($pot->beneficiaryMsisdn) ?></p>

    <div class="mt-4">
        <div class="flex justify-between text-sm mb-1">
            <span><?= money($pot->collectedAmount) ?></span>
            <span class="text-slate-400">objectif <?= money($pot->targetAmount) ?></span>
        </div>
        <div class="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-teal-600" style="width: <?= $pot->progressPercent() ?>%"></div>
        </div>
    </div>

    <?php if ($pot->status === 'open'): ?>
    <form id="pot-contribute" data-slug="<?= e($pot->slug) ?>" class="mt-6 space-y-3">
        <input name="name" placeholder="Votre nom" class="w-full border rounded-lg px-3 py-2">
        <input name="phone" inputmode="tel" placeholder="Votre numéro (07...)" class="w-full border rounded-lg px-3 py-2" required>
        <div class="flex gap-2">
            <input name="amount" inputmode="numeric" placeholder="Montant" class="flex-1 border rounded-lg px-3 py-2" required>
            <select name="gateway" class="border rounded-lg px-3 py-2">
                <?php foreach ($gateways as $g): ?><option value="<?= e($g) ?>"><?= e(gateway_label($g)) ?></option><?php endforeach; ?>
            </select>
        </div>
        <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Contribuer</button>
        <p id="pot-msg" class="text-sm text-center text-rose-600"></p>
    </form>
    <?php else: ?>
        <p class="mt-6 text-center text-emerald-600 font-semibold">🎉 Cagnotte clôturée. Merci !</p>
    <?php endif; ?>
</div>

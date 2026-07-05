<?php /** @var \Transouscris\Models\Recharge $recharge */ ?>
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6 print:shadow-none">
    <div class="text-center border-b pb-4">
        <div class="text-teal-700 font-bold text-lg">Transouscris</div>
        <div class="text-sm text-slate-500">Reçu de recharge</div>
    </div>
    <dl class="mt-4 text-sm divide-y">
        <div class="flex justify-between py-2"><dt class="text-slate-500">Référence</dt><dd class="font-mono">#<?= (int) $recharge->id ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Numéro</dt><dd><?= e($recharge->msisdn) ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Opérateur</dt><dd><?= e(strtoupper($recharge->operatorCode)) ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Type</dt><dd><?= e($recharge->type) ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Montant</dt><dd class="font-semibold"><?= money($recharge->amount) ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Statut</dt><dd><?= e($recharge->status) ?></dd></div>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Date</dt><dd><?= e($recharge->createdAt) ?></dd></div>
        <?php if ($recharge->operatorRef): ?>
        <div class="flex justify-between py-2"><dt class="text-slate-500">Réf. opérateur</dt><dd class="font-mono text-xs"><?= e($recharge->operatorRef) ?></dd></div>
        <?php endif; ?>
    </dl>
    <button onclick="window.print()" class="mt-6 w-full bg-slate-800 text-white rounded-lg py-2 text-sm">Télécharger / Imprimer</button>
</div>

<?php
/** @var \Transouscris\Models\LedgerAccount $wallet */
/** @var array $entries */
/** @var string[] $gateways */
?>
<div class="space-y-6">
    <div class="bg-white rounded-2xl shadow p-6">
        <div class="text-sm text-slate-500">Solde disponible</div>
        <div class="text-3xl font-extrabold text-slate-900"><?= e($wallet->formattedBalance()) ?></div>

        <form id="topup-form" class="mt-4 flex flex-wrap gap-2 items-end">
            <div>
                <label class="text-xs font-medium text-slate-500">Montant</label>
                <input name="amount" inputmode="numeric" placeholder="2000" class="block border rounded-lg px-3 py-2 w-32">
            </div>
            <div>
                <label class="text-xs font-medium text-slate-500">Moyen</label>
                <select name="gateway" class="block border rounded-lg px-3 py-2">
                    <?php foreach ($gateways as $g): ?>
                        <option value="<?= e($g) ?>"><?= e(ucfirst($g)) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button class="bg-teal-700 text-white rounded-lg px-4 py-2 font-semibold">Approvisionner</button>
        </form>
        <p id="topup-msg" class="text-sm mt-2 text-rose-600"></p>
    </div>

    <div>
        <h2 class="font-semibold mb-2">Grand livre du portefeuille</h2>
        <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="text-left text-slate-400 border-b">
                    <tr><th class="p-3">Date</th><th class="p-3">Type</th><th class="p-3 text-right">Mouvement</th><th class="p-3 text-right">Solde</th></tr>
                </thead>
                <tbody class="divide-y">
                    <?php foreach ($entries as $en): ?>
                        <tr>
                            <td class="p-3 text-slate-500"><?= e($en['created_at']) ?></td>
                            <td class="p-3"><?= e($en['type']) ?></td>
                            <td class="p-3 text-right <?= $en['direction'] === 'credit' ? 'text-emerald-600' : 'text-rose-600' ?>">
                                <?= $en['direction'] === 'credit' ? '+' : '−' ?><?= money((int) $en['amount']) ?>
                            </td>
                            <td class="p-3 text-right font-medium"><?= money((int) $en['balance_after']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if (!$entries): ?>
                        <tr><td colspan="4" class="p-4 text-slate-400">Aucun mouvement.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

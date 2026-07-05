<?php /** @var array $rows */ ?>
<h1 class="text-2xl font-bold mb-6">Transactions du grand livre</h1>
<div class="bg-white rounded-xl shadow-sm overflow-x-auto">
    <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b">
            <tr><th class="p-3">#</th><th class="p-3">Référence</th><th class="p-3">Type</th><th class="p-3">Statut</th><th class="p-3 text-right">Montant</th><th class="p-3">Date</th></tr>
        </thead>
        <tbody class="divide-y">
            <?php foreach ($rows as $t): ?>
                <tr>
                    <td class="p-3"><?= (int) $t['id'] ?></td>
                    <td class="p-3 font-mono text-xs"><?= e($t['reference']) ?></td>
                    <td class="p-3"><?= e($t['type']) ?></td>
                    <td class="p-3"><?= e($t['status']) ?></td>
                    <td class="p-3 text-right"><?= money((int) $t['total']) ?></td>
                    <td class="p-3 text-slate-500"><?= e($t['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

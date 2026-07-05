<?php /** @var array $rows */ ?>
<h1 class="text-2xl font-bold mb-6">Agents</h1>
<div class="bg-white rounded-xl shadow-sm overflow-x-auto">
    <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b">
            <tr><th class="p-3">Code</th><th class="p-3">Nom</th><th class="p-3">Téléphone</th><th class="p-3">Zone</th><th class="p-3">Dispo</th><th class="p-3 text-right">Note</th><th class="p-3 text-right">Fiabilité</th></tr>
        </thead>
        <tbody class="divide-y">
            <?php foreach ($rows as $a): ?>
                <tr>
                    <td class="p-3 font-mono text-xs"><?= e($a['code']) ?></td>
                    <td class="p-3"><?= e($a['display_name']) ?></td>
                    <td class="p-3"><?= e($a['phone']) ?></td>
                    <td class="p-3"><?= e($a['zone'] ?? '—') ?></td>
                    <td class="p-3"><?= ((int) $a['is_available']) ? '🟢' : '⚪' ?></td>
                    <td class="p-3 text-right">⭐ <?= number_format((float) $a['rating_avg'], 1) ?></td>
                    <td class="p-3 text-right"><?= (int) $a['reliability_score'] ?>%</td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

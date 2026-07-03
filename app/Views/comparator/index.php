<?php
/** @var array $items */
/** @var int|null $bestCostPerGo */
$opColor = ['orange' => '#FF7900', 'mtn' => '#FFCC00', 'moov' => '#004B9F'];
?>
<div class="space-y-4">
    <div>
        <h1 class="text-xl font-bold">Comparateur de forfaits internet</h1>
        <p class="text-sm text-slate-500">Classés par <strong>coût par Go</strong> — le meilleur rapport qualité/prix est mis en évidence.</p>
    </div>

    <div class="flex flex-wrap gap-2 items-center">
        <input id="cmp-search" placeholder="Rechercher (nom, volume…)" class="border rounded-lg px-3 py-1.5 text-sm">
        <select id="cmp-op" class="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">Tous les réseaux</option>
            <option value="orange">Orange</option>
            <option value="mtn">MTN</option>
            <option value="moov">Moov</option>
        </select>
        <label class="text-sm text-slate-500 flex items-center gap-1">
            Prix max
            <input id="cmp-max" type="number" placeholder="∞" class="border rounded-lg px-2 py-1 w-24 text-sm">
        </label>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="text-left text-slate-400 border-b">
                <tr>
                    <th class="p-3">Réseau</th>
                    <th class="p-3">Forfait</th>
                    <th class="p-3 text-right">Prix</th>
                    <th class="p-3 text-right">Volume</th>
                    <th class="p-3">Durée</th>
                    <th class="p-3 text-right">Coût / Go</th>
                    <th class="p-3"></th>
                </tr>
            </thead>
            <tbody class="divide-y" id="cmp-rows">
                <?php foreach ($items as $it): ?>
                    <?php $isBest = $it['cost_per_go'] !== null && $it['cost_per_go'] === $bestCostPerGo; ?>
                    <tr class="<?= $isBest ? 'bg-emerald-50' : '' ?>"
                        data-op="<?= e($it['operator']) ?>" data-price="<?= (int) $it['price'] ?>"
                        data-text="<?= e(strtolower($it['name'] . ' ' . $it['volume'])) ?>">
                        <td class="p-3">
                            <span class="inline-flex items-center gap-1 font-semibold">
                                <span class="w-2.5 h-2.5 rounded-full" style="background: <?= e($opColor[$it['operator']] ?? '#999') ?>"></span>
                                <?= e(strtoupper($it['operator'])) ?>
                            </span>
                        </td>
                        <td class="p-3"><?= e($it['name']) ?></td>
                        <td class="p-3 text-right font-semibold"><?= money($it['price']) ?></td>
                        <td class="p-3 text-right"><?= e($it['volume']) ?></td>
                        <td class="p-3 text-slate-500"><?= e($it['validity']) ?></td>
                        <td class="p-3 text-right">
                            <?= $it['cost_per_go'] !== null ? money($it['cost_per_go']) . '/Go' : '—' ?>
                        </td>
                        <td class="p-3 text-right">
                            <?php if ($isBest): ?>
                                <span class="text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5">★ Meilleur prix</span>
                            <?php endif; ?>
                            <a href="/recharge?operator=<?= e($it['operator']) ?>&type=internet" class="text-xs text-teal-700 underline ml-1">Souscrire</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

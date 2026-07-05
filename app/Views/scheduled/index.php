<?php /** @var \Transouscris\Models\ScheduledRecharge[] $schedules */ ?>
<div class="space-y-6">
    <div class="bg-white rounded-2xl shadow p-6">
        <h1 class="text-xl font-bold">Recharges programmées</h1>
        <p class="text-sm text-slate-500 mt-1">
            Rechargez automatiquement un numéro à intervalle régulier, depuis votre portefeuille.
        </p>

        <form id="sched-form" class="mt-5 grid sm:grid-cols-2 gap-3">
            <div>
                <label class="text-sm font-medium">Numéro</label>
                <input name="phone" inputmode="tel" placeholder="07 00 00 00 00" class="mt-1 w-full border rounded-lg px-3 py-2" required>
            </div>
            <div>
                <label class="text-sm font-medium">Réseau</label>
                <select name="operator" class="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="orange">Orange</option>
                    <option value="mtn">MTN</option>
                    <option value="moov">Moov</option>
                </select>
            </div>
            <div>
                <label class="text-sm font-medium">Montant (F CFA)</label>
                <input name="amount" inputmode="numeric" placeholder="1000" class="mt-1 w-full border rounded-lg px-3 py-2" required>
            </div>
            <div>
                <label class="text-sm font-medium">Fréquence</label>
                <select name="frequency" class="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="monthly">Mensuelle</option>
                    <option value="weekly">Hebdomadaire</option>
                </select>
            </div>
            <div class="sm:col-span-2">
                <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Programmer</button>
                <p id="sched-msg" class="text-sm text-center text-rose-600 mt-1"></p>
            </div>
        </form>
    </div>

    <div class="bg-white rounded-xl shadow-sm divide-y" id="sched-list">
        <?php if (!$schedules): ?>
            <p class="p-4 text-sm text-slate-500">Aucune programmation.</p>
        <?php else: foreach ($schedules as $s): ?>
            <div class="flex items-center justify-between p-4" data-sched="<?= (int) $s->id ?>">
                <div>
                    <div class="font-medium"><?= e($s->msisdn) ?> · <?= e(strtoupper($s->operatorCode)) ?></div>
                    <div class="text-xs text-slate-500">
                        <?= money($s->rechargeAmount) ?> · <?= e($s->frequencyLabel()) ?>
                        · prochaine : <?= e($s->nextRunAt ?? '—') ?>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs px-2 py-0.5 rounded-full <?= $s->isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500' ?>">
                        <?= $s->isActive ? 'Active' : 'En pause' ?>
                    </span>
                    <button class="sched-run text-xs bg-teal-700 text-white rounded px-2 py-1" title="Exécuter maintenant">▶ Exécuter</button>
                    <button class="sched-toggle text-xs border rounded px-2 py-1"><?= $s->isActive ? 'Pause' : 'Activer' ?></button>
                    <button class="sched-del text-xs text-rose-600 border border-rose-200 rounded px-2 py-1">Suppr.</button>
                </div>
            </div>
        <?php endforeach; endif; ?>
    </div>

    <p class="text-xs text-slate-400">
        En production, un worker exécute les échéances dues :
        <code>php bin/console.php scheduled:run</code> (via cron).
    </p>
</div>

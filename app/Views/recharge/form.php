<?php
/** @var string|null $preOperator */
/** @var string|null $preType */
/** @var string|null $myNumber */
/** @var string[] $recentNumbers */

$networks = [
    'orange' => ['name' => 'Orange', 'color' => '#FF7900'],
    'mtn'    => ['name' => 'MTN',    'color' => '#FFCC00'],
    'moov'   => ['name' => 'Moov',   'color' => '#004B9F'],
];
?>
<div id="recharge-flow"
     class="max-w-md mx-auto"
     data-my="<?= e($myNumber ?? '') ?>"
     data-operator="<?= e($preOperator ?? '') ?>"
     data-type="<?= e($preType ?? '') ?>">

    <!-- En-tête : retour + sélecteur de réseau (modifiable) -->
    <div class="flex items-center justify-between mb-4">
        <a href="/dashboard" class="text-sm text-slate-500 hover:text-slate-700">← Accueil</a>
        <div class="flex gap-1">
            <?php foreach ($networks as $code => $net): ?>
                <button type="button" class="rc-net text-xs font-semibold rounded-full px-3 py-1 border-2 border-slate-200"
                        data-op="<?= e($code) ?>" data-color="<?= e($net['color']) ?>"><?= e($net['name']) ?></button>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
        <!-- Étape TYPE -->
        <section class="rc-step" data-step="type">
            <h2 class="text-lg font-bold mb-3">Type d'opération</h2>
            <div class="grid grid-cols-2 gap-3">
                <button type="button" class="rc-type rounded-xl border-2 border-slate-200 p-4 text-left hover:border-slate-300" data-type="credit">
                    <div class="text-2xl">💸</div>
                    <div class="font-semibold mt-1">Crédit</div>
                    <div class="text-xs text-slate-500">Transfert direct</div>
                </button>
                <button type="button" class="rc-type rounded-xl border-2 border-slate-200 p-4 text-left hover:border-slate-300" data-type="forfait">
                    <div class="text-2xl">📦</div>
                    <div class="font-semibold mt-1">Forfait</div>
                    <div class="text-xs text-slate-500">Internet, appels, SMS</div>
                </button>
            </div>
            <div id="rc-forfait-sub" class="hidden mt-3">
                <div class="text-sm font-medium text-slate-500 mb-2">Quel type de forfait ?</div>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" class="rc-cat rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="internet">📶 Internet</button>
                    <button type="button" class="rc-cat rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="voice">📞 Appels</button>
                    <button type="button" class="rc-cat rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="sms">✉️ SMS</button>
                </div>
            </div>
            <button type="button" class="rc-next mt-5 hidden w-full bg-teal-700 text-white rounded-lg py-3 font-semibold">Suivant →</button>
        </section>

        <!-- Étape NUMÉRO -->
        <section class="rc-step hidden" data-step="number">
            <button type="button" class="rc-back text-sm text-slate-500 mb-2">← Retour</button>
            <h2 class="text-lg font-bold">Numéro destinataire</h2>
            <p class="text-xs text-slate-500 mb-3">Entrez le numéro qui recevra le crédit ou le forfait.</p>

            <div class="flex gap-2">
                <input id="rc-phone" inputmode="tel" placeholder="07 00 00 00 00" class="flex-1 border rounded-lg px-3 py-2" required>
                <?php if (!empty($myNumber)): ?>
                    <button type="button" id="rc-me" class="whitespace-nowrap text-sm bg-slate-100 hover:bg-slate-200 rounded-lg px-3">Moi-même</button>
                <?php endif; ?>
            </div>

            <?php if (!empty($recentNumbers)): ?>
                <div class="mt-3">
                    <div class="text-xs text-slate-400 mb-1">Récents</div>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($recentNumbers as $num): ?>
                            <button type="button" class="rc-recent text-xs bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1" data-num="<?= e($num) ?>"><?= e($num) ?></button>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <div id="rc-op-hint" class="text-sm mt-2 text-slate-500"></div>
            <button type="button" class="rc-next mt-4 w-full bg-teal-700 text-white rounded-lg py-3 font-semibold">Suivant →</button>
            <p class="rc-err text-sm text-center text-rose-600 mt-2"></p>
        </section>

        <!-- Étape MONTANT (crédit) -->
        <section class="rc-step hidden" data-step="amount">
            <button type="button" class="rc-back text-sm text-slate-500 mb-2">← Retour</button>
            <h2 class="text-lg font-bold">Montant du crédit</h2>
            <div class="grid grid-cols-3 gap-2 mt-3">
                <?php foreach ([500, 1000, 2000, 5000, 10000, 20000] as $amt): ?>
                    <button type="button" class="rc-amount rounded-lg border-2 border-slate-200 py-3 text-sm font-semibold hover:border-slate-300" data-amount="<?= $amt ?>"><?= money($amt) ?></button>
                <?php endforeach; ?>
            </div>
            <div class="mt-3">
                <label class="text-sm font-medium">Autre montant</label>
                <input id="rc-amount-custom" inputmode="numeric" placeholder="Ex : 1500" class="mt-1 w-full border rounded-lg px-3 py-2">
            </div>
            <button type="button" class="rc-next mt-4 w-full bg-teal-700 text-white rounded-lg py-3 font-semibold">Suivant →</button>
            <p class="rc-err text-sm text-center text-rose-600 mt-2"></p>
        </section>

        <!-- Étape FORFAITS -->
        <section class="rc-step hidden" data-step="plans">
            <button type="button" class="rc-back text-sm text-slate-500 mb-2">← Retour</button>
            <h2 class="text-lg font-bold">Choisir un forfait</h2>
            <div id="rc-subcats" class="flex flex-wrap gap-2 mt-3"></div>
            <div id="rc-plan-list" class="mt-3 space-y-2 max-h-96 overflow-y-auto"></div>
            <p id="rc-plans-empty" class="text-sm text-slate-400 hidden">Aucun forfait dans cette catégorie.</p>
        </section>

        <!-- Étape CONFIRMATION -->
        <section class="rc-step hidden" data-step="confirm">
            <button type="button" class="rc-back text-sm text-slate-500 mb-2">← Retour</button>
            <h2 class="text-lg font-bold">Confirmation</h2>
            <dl id="rc-summary" class="mt-3 text-sm divide-y rounded-lg border"></dl>
            <button type="button" id="rc-submit" class="mt-4 w-full bg-teal-700 text-white rounded-lg py-3 font-semibold">Payer depuis mon portefeuille</button>
            <p class="rc-err text-sm text-center text-rose-600 mt-2"></p>
        </section>
    </div>
</div>

<?php
/** @var \Transouscris\Models\LedgerAccount $wallet */
/** @var \Transouscris\Models\Recharge[] $recent */

// Réseaux disponibles (libellé + couleur de marque) pour l'assistant.
$networks = [
    'orange' => ['name' => 'Orange', 'color' => '#FF7900'],
    'mtn'    => ['name' => 'MTN',    'color' => '#FFCC00'],
    'moov'   => ['name' => 'Moov',   'color' => '#004B9F'],
];
?>
<div class="space-y-6">
    <div class="bg-gradient-to-br from-teal-700 to-teal-600 text-white rounded-2xl p-6 shadow">
        <div class="text-sm opacity-80">Solde du portefeuille</div>
        <div class="text-3xl font-extrabold mt-1"><?= e($wallet->formattedBalance()) ?></div>
        <a href="/wallet" class="inline-block mt-4 bg-white/20 rounded-lg px-4 py-2 text-sm">Approvisionner</a>
    </div>

    <!-- ── Assistant : réseau → type d'opération → Suivant ─────────── -->
    <div id="op-wizard" class="bg-white rounded-2xl shadow p-6">
        <h2 class="font-bold text-lg text-slate-900">Nouvelle opération</h2>

        <!-- Étape 1 : réseau -->
        <div class="mt-4">
            <div class="text-sm font-medium text-slate-500 mb-2">1. Choisissez le réseau</div>
            <div class="grid grid-cols-3 gap-3">
                <?php foreach ($networks as $code => $net): ?>
                    <button type="button" class="op-net rounded-xl border-2 border-slate-200 py-4 font-semibold transition hover:border-slate-300"
                            data-op="<?= e($code) ?>" data-color="<?= e($net['color']) ?>">
                        <span class="block w-8 h-8 mx-auto rounded-full mb-2" style="background: <?= e($net['color']) ?>"></span>
                        <?= e($net['name']) ?>
                    </button>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Étape 2 : type d'opération -->
        <div id="op-step-2" class="mt-5 hidden">
            <div class="text-sm font-medium text-slate-500 mb-2">2. Type d'opération</div>
            <div class="grid grid-cols-2 gap-3">
                <button type="button" class="op-type rounded-xl border-2 border-slate-200 py-4 px-3 text-left hover:border-slate-300" data-type="credit">
                    <div class="font-semibold">Crédit</div>
                    <div class="text-xs text-slate-500">Transfert direct</div>
                </button>
                <button type="button" class="op-type rounded-xl border-2 border-slate-200 py-4 px-3 text-left hover:border-slate-300" data-type="forfait">
                    <div class="font-semibold">Forfait</div>
                    <div class="text-xs text-slate-500">Internet, appels, SMS</div>
                </button>
            </div>

            <!-- Sous-type forfait -->
            <div id="op-forfait" class="mt-3 hidden">
                <div class="text-sm font-medium text-slate-500 mb-2">Choisissez le forfait</div>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" class="op-sub rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="internet">📶 Internet</button>
                    <button type="button" class="op-sub rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="voice">📞 Appels</button>
                    <button type="button" class="op-sub rounded-lg border-2 border-slate-200 py-3 text-sm hover:border-slate-300" data-type="sms">✉️ SMS</button>
                </div>
            </div>
        </div>

        <!-- Étape 3 : bouton Suivant -->
        <div id="op-step-3" class="mt-5 hidden">
            <a id="op-next" href="#" class="block w-full text-center bg-teal-700 text-white rounded-lg py-3 font-semibold">
                Suivant →
            </a>
        </div>
    </div>

    <div>
        <h2 class="font-semibold text-slate-900 mb-2">Recharges récentes</h2>
        <div class="bg-white rounded-xl shadow-sm divide-y">
            <?php if (!$recent): ?>
                <p class="p-4 text-sm text-slate-500">Aucune recharge pour l'instant.</p>
            <?php else: foreach ($recent as $r): ?>
                <a href="/recharge/<?= (int) $r->id ?>/receipt" class="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div>
                        <div class="font-medium"><?= e($r->msisdn) ?> · <?= e(strtoupper($r->operatorCode)) ?></div>
                        <div class="text-xs text-slate-500"><?= e($r->createdAt) ?> · <?= e($r->type) ?></div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold"><?= money($r->amount) ?></div>
                        <span class="text-xs px-2 py-0.5 rounded-full <?= $r->status === 'success' ? 'bg-emerald-100 text-emerald-700' : ($r->status === 'refunded' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600') ?>">
                            <?= e($r->status) ?>
                        </span>
                    </div>
                </a>
            <?php endforeach; endif; ?>
        </div>
    </div>
</div>

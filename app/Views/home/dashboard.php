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

    <!-- Menu rapide -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <?php
        $menu = [
            ['/recharge', '💸', 'Recharger'],
            ['/comparateur', '⚖️', 'Comparer'],
            ['/favoris', '⭐', 'Favoris'],
            ['/programmees', '🔁', 'Programmées'],
            ['/historique', '🧾', 'Historique'],
            ['/codes-utiles', '📞', 'Codes USSD'],
        ];
        foreach ($menu as [$href, $icon, $label]): ?>
            <a href="<?= $href ?>" class="bg-white rounded-xl shadow-sm p-3 text-center hover:shadow transition">
                <div class="text-2xl"><?= $icon ?></div>
                <div class="text-xs font-medium mt-1 text-slate-600"><?= e($label) ?></div>
            </a>
        <?php endforeach; ?>
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
            <div class="text-sm font-medium text-slate-500 mb-2">2. Que voulez-vous faire ?</div>
            <div class="grid grid-cols-3 gap-3">
                <button type="button" class="op-type rounded-xl border-2 border-slate-200 py-4 px-2 text-center transition duration-150 hover:-translate-y-1 hover:border-teal-400 hover:shadow-md" data-type="credit">
                    <div class="text-2xl">📱</div>
                    <div class="font-semibold text-sm mt-1">Acheter crédit</div>
                </button>
                <button type="button" class="op-type rounded-xl border-2 border-slate-200 py-4 px-2 text-center transition duration-150 hover:-translate-y-1 hover:border-teal-400 hover:shadow-md" data-type="forfait">
                    <div class="text-2xl">🌐</div>
                    <div class="font-semibold text-sm mt-1">Acheter forfait</div>
                </button>
                <button type="button" class="op-type rounded-xl border-2 border-slate-200 py-4 px-2 text-center transition duration-150 hover:-translate-y-1 hover:border-teal-400 hover:shadow-md" data-type="transfer">
                    <div class="text-2xl">💸</div>
                    <div class="font-semibold text-sm mt-1">Transférer</div>
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

    <?php
    // ── Analytique ────────────────────────────────────────────
    $typeLabel = static fn (?string $t): string => match ($t) {
        'credit' => 'Crédit', 'internet' => 'Forfait internet', 'voice' => 'Forfait appels',
        'sms' => 'Forfait SMS', 'transfer' => 'Transfert', default => '—',
    };
    $maxDaily = max(1, ...array_map(static fn ($d) => $d['value'], $stats['daily']));
    $opColor  = ['orange' => '#FF7900', 'mtn' => '#FFCC00', 'moov' => '#004B9F'];
    $opTotal  = array_sum(array_map(static fn ($o) => (int) $o['c'], $stats['by_operator'])) ?: 1;
    ?>

    <!-- Statistiques -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <?php
        $tiles = [
            ['Transactions', number_format((int) $stats['total_tx'], 0, ',', ' '), '📊'],
            ['Dépenses du mois', money((int) $stats['month_spend']), '📅'],
            ['Réseau préféré', $stats['top_operator'] ? strtoupper($stats['top_operator']) : '—', '📶'],
            ['Opération favorite', $typeLabel($stats['top_type']), '⭐'],
        ];
        foreach ($tiles as [$label, $value, $icon]): ?>
            <div class="bg-white rounded-xl shadow-sm p-4">
                <div class="text-lg"><?= $icon ?></div>
                <div class="text-xs text-slate-500 mt-1"><?= e($label) ?></div>
                <div class="text-lg font-bold text-slate-900 truncate"><?= e($value) ?></div>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
        <!-- Graphique : dépenses des 7 derniers jours -->
        <div class="bg-white rounded-xl shadow-sm p-4">
            <h2 class="font-semibold text-slate-900 mb-3">Dépenses (7 jours)</h2>
            <svg viewBox="0 0 280 130" class="w-full" role="img" aria-label="Dépenses des 7 derniers jours">
                <?php foreach ($stats['daily'] as $i => $d):
                    $h = (int) round(($d['value'] / $maxDaily) * 90);
                    $x = 10 + $i * 38; $y = 100 - $h; ?>
                    <rect x="<?= $x ?>" y="<?= $y ?>" width="24" height="<?= max($h, 2) ?>" rx="3" fill="#0d9488"></rect>
                    <text x="<?= $x + 12 ?>" y="115" text-anchor="middle" font-size="8" fill="#94a3b8"><?= e($d['label']) ?></text>
                    <?php if ($d['value'] > 0): ?>
                        <text x="<?= $x + 12 ?>" y="<?= $y - 3 ?>" text-anchor="middle" font-size="7" fill="#64748b"><?= (int) round($d['value'] / 1000) ?>k</text>
                    <?php endif; ?>
                <?php endforeach; ?>
            </svg>
        </div>

        <!-- Répartition par réseau -->
        <div class="bg-white rounded-xl shadow-sm p-4">
            <h2 class="font-semibold text-slate-900 mb-3">Répartition par réseau</h2>
            <?php if (!$stats['by_operator']): ?>
                <p class="text-sm text-slate-400">Aucune donnée.</p>
            <?php else: foreach ($stats['by_operator'] as $o):
                $pct = (int) round(((int) $o['c'] / $opTotal) * 100); ?>
                <div class="mb-2">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="font-medium"><?= e(strtoupper($o['operator_code'])) ?></span>
                        <span class="text-slate-500"><?= $pct ?>% · <?= money((int) $o['s']) ?></span>
                    </div>
                    <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width: <?= $pct ?>%; background: <?= e($opColor[$o['operator_code']] ?? '#0d9488') ?>"></div>
                    </div>
                </div>
            <?php endforeach; endif; ?>
        </div>
    </div>

    <!-- Recommandations -->
    <?php if (!empty($stats['reco'])): ?>
    <div>
        <h2 class="font-semibold text-slate-900 mb-2">Recommandé pour vous</h2>
        <div class="grid sm:grid-cols-3 gap-3">
            <?php foreach ($stats['reco'] as $rec):
                $isDirect = in_array($rec['type'], ['credit', 'transfer'], true);
                $href = '/recharge?operator=' . urlencode($rec['operator_code']) . '&type=' . urlencode($rec['type'])
                    . ($isDirect ? '&amount=' . (int) $rec['amount'] : ''); ?>
                <a href="<?= e($href) ?>" class="bg-white rounded-xl shadow-sm p-4 hover:shadow transition block">
                    <div class="text-xs text-teal-700 font-medium">Vous en achetez souvent</div>
                    <div class="font-semibold mt-1"><?= e($typeLabel($rec['type'])) ?> · <?= e(strtoupper($rec['operator_code'])) ?></div>
                    <?php if ($isDirect): ?><div class="text-sm text-slate-500"><?= money((int) $rec['amount']) ?></div><?php endif; ?>
                    <div class="mt-2 text-xs bg-teal-700 text-white inline-block rounded px-2 py-1">↻ Souscrire à nouveau</div>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

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

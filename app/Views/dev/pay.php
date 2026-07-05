<?php /** @var \Transouscris\Models\PaymentIntent $intent */ ?>
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6 mt-6">
    <div class="text-center">
        <span class="inline-block text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
            🧪 Simulateur de paiement — mode développement
        </span>
    </div>

    <div class="mt-6 text-center">
        <div class="text-sm text-slate-500">Montant à payer</div>
        <div class="text-3xl font-extrabold text-slate-900"><?= money($intent->amount) ?></div>
        <div class="text-xs text-slate-400 mt-1">Réf. <?= e($intent->reference) ?></div>
    </div>

    <p class="text-sm text-slate-500 mt-4 text-center">
        Aucun paiement réel n'est effectué. Confirmez pour simuler un paiement
        réussi (le portefeuille sera crédité), ou annulez.
    </p>

    <div class="mt-6 grid grid-cols-2 gap-3">
        <form method="post" action="/dev/pay/cancel">
            <?= csrf_field() ?>
            <input type="hidden" name="ref" value="<?= e($intent->reference) ?>">
            <button class="w-full border border-slate-300 text-slate-700 rounded-lg py-2 font-semibold">Annuler</button>
        </form>
        <form method="post" action="/dev/pay/confirm">
            <?= csrf_field() ?>
            <input type="hidden" name="ref" value="<?= e($intent->reference) ?>">
            <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Confirmer le paiement</button>
        </form>
    </div>
</div>

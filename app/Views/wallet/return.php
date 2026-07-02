<?php /** @var \Transouscris\Models\PaymentIntent|null $intent */ ?>
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6 text-center">
    <?php if ($intent && $intent->status === 'paid'): ?>
        <div class="text-4xl">✅</div>
        <h1 class="text-xl font-bold mt-2">Paiement confirmé</h1>
        <p class="text-slate-500 mt-1"><?= money($intent->amount) ?> ont été crédités.</p>
    <?php elseif ($intent): ?>
        <div class="text-4xl">⏳</div>
        <h1 class="text-xl font-bold mt-2">Paiement en cours de vérification</h1>
        <p class="text-slate-500 mt-1">Nous confirmons la transaction auprès du fournisseur. Le solde sera mis à jour automatiquement.</p>
    <?php else: ?>
        <div class="text-4xl">❓</div>
        <h1 class="text-xl font-bold mt-2">Transaction introuvable</h1>
    <?php endif; ?>
    <a href="/wallet" class="inline-block mt-6 bg-teal-700 text-white rounded-lg px-4 py-2">Voir mon portefeuille</a>
</div>

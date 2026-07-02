<div class="text-center py-10">
    <h1 class="text-3xl md:text-4xl font-extrabold text-slate-900">Rechargez en un geste, partout en Côte d'Ivoire</h1>
    <p class="mt-4 text-slate-600 max-w-xl mx-auto">
        Crédit et forfaits Orange, MTN et Moov. Portefeuille sécurisé, paiement mobile money,
        cagnottes de recharge et garantie de remboursement automatique.
    </p>
    <div class="mt-8">
        <a href="/login" class="inline-block bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold shadow">
            Commencer
        </a>
    </div>

    <div class="grid sm:grid-cols-3 gap-4 mt-14 text-left">
        <?php
        $features = [
            ['⚡', 'Recharge instantanée', 'Détection automatique de l\'opérateur par le numéro.'],
            ['🔒', 'Portefeuille sécurisé', 'Grand livre en partie double, chaque F CFA tracé.'],
            ['🤝', 'Cagnotte partagée', 'Cotisez à plusieurs pour recharger un proche.'],
            ['🛡️', 'Remboursement garanti', 'Recharge non confirmée ? Remboursement automatique.'],
            ['📶', 'Mode hors-ligne', 'Vos demandes sont mises en file et rejouées.'],
            ['🌍', 'Support diaspora', 'Rechargez depuis l\'étranger par carte bancaire.'],
        ];
        foreach ($features as [$icon, $t, $d]): ?>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <div class="text-2xl"><?= $icon ?></div>
                <div class="font-semibold mt-2"><?= e($t) ?></div>
                <p class="text-sm text-slate-500 mt-1"><?= e($d) ?></p>
            </div>
        <?php endforeach; ?>
    </div>
</div>

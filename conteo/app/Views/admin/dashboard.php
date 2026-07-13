<?php
use App\Helpers\Sanitize;
/** @var array $stats @var array $recent */
?>
<h1>Tableau de bord</h1>
<div class="cards">
    <div class="card"><div class="n"><?= number_format($stats['users']) ?></div><div class="l">Parents inscrits</div></div>
    <div class="card"><div class="n"><?= number_format($stats['children']) ?></div><div class="l">Profils enfants</div></div>
    <div class="card"><div class="n"><?= number_format($stats['tales']) ?></div><div class="l">Contes</div></div>
    <div class="card"><div class="n"><?= number_format($stats['subs_active']) ?></div><div class="l">Abonnements actifs</div></div>
    <div class="card"><div class="n"><?= number_format($stats['revenue']) ?></div><div class="l">FCFA encaissés</div></div>
    <div class="card"><div class="n"><?= number_format($stats['pay_pending']) ?></div><div class="l">Paiements en attente</div></div>
</div>

<h2>Dernières transactions</h2>
<table>
    <thead><tr><th>Référence</th><th>Fournisseur</th><th>Montant</th><th>Statut</th><th>Vérifié</th><th>Date</th></tr></thead>
    <tbody>
    <?php foreach ($recent as $p): ?>
        <tr>
            <td><?= Sanitize::html($p['reference']) ?></td>
            <td><?= Sanitize::html($p['provider']) ?></td>
            <td><?= number_format((int)$p['amount_fcfa']) ?> F</td>
            <td><?php $c = $p['status']==='success'?'ok':($p['status']==='pending'?'pending':'fail'); ?>
                <span class="tag <?= $c ?>"><?= Sanitize::html($p['status']) ?></span></td>
            <td><?= $p['verified_at'] ? '✓' : '—' ?></td>
            <td><?= Sanitize::html($p['created_at']) ?></td>
        </tr>
    <?php endforeach; ?>
    <?php if (!$recent): ?><tr><td colspan="6">Aucune transaction.</td></tr><?php endif; ?>
    </tbody>
</table>

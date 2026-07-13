<?php
use App\Helpers\Sanitize;
/** @var array $payments */
?>
<h1>Transactions</h1>
<table>
    <thead><tr><th>Référence</th><th>Téléphone</th><th>Fournisseur</th><th>Canal</th><th>Montant</th><th>Objet</th><th>Statut</th><th>Vérifié le</th></tr></thead>
    <tbody>
    <?php foreach ($payments as $p): ?>
        <tr>
            <td><?= Sanitize::html($p['reference']) ?></td>
            <td><?= Sanitize::html($p['phone']) ?></td>
            <td><?= Sanitize::html($p['provider']) ?></td>
            <td><?= Sanitize::html($p['channel'] ?? '—') ?></td>
            <td><?= number_format((int)$p['amount_fcfa']) ?> F</td>
            <td><?= Sanitize::html($p['purpose']) ?></td>
            <td><?php $c=$p['status']==='success'?'ok':($p['status']==='pending'?'pending':'fail'); ?>
                <span class="tag <?= $c ?>"><?= Sanitize::html($p['status']) ?></span></td>
            <td><?= $p['verified_at'] ? Sanitize::html($p['verified_at']) : '—' ?></td>
        </tr>
    <?php endforeach; ?>
    <?php if (!$payments): ?><tr><td colspan="8">Aucune transaction.</td></tr><?php endif; ?>
    </tbody>
</table>

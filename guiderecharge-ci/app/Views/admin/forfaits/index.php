<?php
/** Liste admin des forfaits. Variable : $forfaits. */

use App\Core\Csrf;

/** @var array<int,array<string,mixed>> $forfaits */
?>
<div class="admin-panel-head">
    <input type="search" class="admin-search" data-table="fTable" placeholder="Filtrer les forfaits…" aria-label="Filtrer">
    <a href="<?= url('/admin/forfaits/create') ?>" class="btn btn-primary">+ Nouveau forfait</a>
</div>

<div class="admin-table-scroll">
    <table class="admin-table" id="fTable">
        <thead>
            <tr><th>Nom</th><th>Opérateur</th><th>Catégorie</th><th>Prix</th><th>Data</th><th>Pop.</th><th>État</th><th>Actions</th></tr>
        </thead>
        <tbody>
            <?php if ($forfaits === []): ?>
                <tr><td colspan="8" class="empty-sm">Aucun forfait.</td></tr>
            <?php else: ?>
                <?php foreach ($forfaits as $f): ?>
                    <tr>
                        <td><strong><?= e($f['nom']) ?></strong></td>
                        <td><span class="op-badge op-badge-sm" style="background: <?= e($f['operateur_couleur']) ?>"><?= e($f['operateur_nom']) ?></span></td>
                        <td><?= e($f['categorie_nom']) ?></td>
                        <td><?= fcfa((int) $f['prix']) ?></td>
                        <td><?= e($f['volume_data'] ?: '—') ?></td>
                        <td><?= (int) $f['populaire'] === 1 ? '★' : '—' ?></td>
                        <td><?= (int) $f['actif'] === 1 ? '<span class="tag tag-on">Actif</span>' : '<span class="tag tag-off">Inactif</span>' ?></td>
                        <td class="row-actions">
                            <a href="<?= url('/admin/forfaits/' . (int) $f['id'] . '/edit') ?>" class="btn btn-ghost btn-sm">Modifier</a>
                            <form action="<?= url('/admin/forfaits/' . (int) $f['id'] . '/delete') ?>" method="post" class="inline-form js-confirm" data-confirm="Supprimer « <?= e($f['nom']) ?> » ?">
                                <?= Csrf::field() ?>
                                <button type="submit" class="btn btn-danger btn-sm">Suppr.</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>
</div>

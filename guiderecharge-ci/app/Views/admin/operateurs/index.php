<?php
/** Liste admin des opérateurs. Variable : $operateurs. */

use App\Core\Csrf;

/** @var array<int,array<string,mixed>> $operateurs */
?>
<div class="admin-panel-head">
    <input type="search" class="admin-search" data-table="opTable" placeholder="Filtrer les opérateurs…" aria-label="Filtrer">
    <a href="<?= url('/admin/operateurs/create') ?>" class="btn btn-primary">+ Nouvel opérateur</a>
</div>

<div class="admin-table-scroll">
    <table class="admin-table" id="opTable">
        <thead>
            <tr><th>Nom</th><th>Slug</th><th>Couleur</th><th>Préfixes</th><th>Code racine</th><th>État</th><th>Actions</th></tr>
        </thead>
        <tbody>
            <?php if ($operateurs === []): ?>
                <tr><td colspan="7" class="empty-sm">Aucun opérateur.</td></tr>
            <?php else: ?>
                <?php foreach ($operateurs as $op): ?>
                    <tr>
                        <td><strong><?= e($op['nom']) ?></strong></td>
                        <td><code><?= e($op['slug']) ?></code></td>
                        <td><span class="color-swatch" style="background: <?= e($op['couleur_hex']) ?>"></span><?= e($op['couleur_hex']) ?></td>
                        <td><?= e($op['prefixes']) ?></td>
                        <td><code><?= e($op['ussd_base']) ?></code></td>
                        <td><?= (int) $op['actif'] === 1 ? '<span class="tag tag-on">Actif</span>' : '<span class="tag tag-off">Inactif</span>' ?></td>
                        <td class="row-actions">
                            <a href="<?= url('/admin/operateurs/' . (int) $op['id'] . '/edit') ?>" class="btn btn-ghost btn-sm">Modifier</a>
                            <form action="<?= url('/admin/operateurs/' . (int) $op['id'] . '/delete') ?>" method="post" class="inline-form js-confirm" data-confirm="Supprimer l'opérateur « <?= e($op['nom']) ?> » ?">
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

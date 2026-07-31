<?php
/** Liste admin des guides. Variable : $guides. */

use App\Core\Csrf;

/** @var array<int,array<string,mixed>> $guides */
?>
<div class="admin-panel-head">
    <input type="search" class="admin-search" data-table="gTable" placeholder="Filtrer les guides…" aria-label="Filtrer">
    <a href="<?= url('/admin/guides/create') ?>" class="btn btn-primary">+ Nouveau guide</a>
</div>

<div class="admin-table-scroll">
    <table class="admin-table" id="gTable">
        <thead>
            <tr><th>Titre</th><th>Catégorie</th><th>Opérateur</th><th>Vues</th><th>État</th><th>Actions</th></tr>
        </thead>
        <tbody>
            <?php if ($guides === []): ?>
                <tr><td colspan="6" class="empty-sm">Aucun guide.</td></tr>
            <?php else: ?>
                <?php foreach ($guides as $g): ?>
                    <tr>
                        <td><strong><?= e($g['titre']) ?></strong></td>
                        <td><?= e($g['categorie'] ?: '—') ?></td>
                        <td><?= e($g['operateur_nom'] ?? '—') ?></td>
                        <td><?= (int) ($g['vues'] ?? 0) ?></td>
                        <td><?= (int) $g['actif'] === 1 ? '<span class="tag tag-on">Publié</span>' : '<span class="tag tag-off">Brouillon</span>' ?></td>
                        <td class="row-actions">
                            <a href="<?= url('/admin/guides/' . (int) $g['id'] . '/edit') ?>" class="btn btn-ghost btn-sm">Modifier</a>
                            <form action="<?= url('/admin/guides/' . (int) $g['id'] . '/delete') ?>" method="post" class="inline-form js-confirm" data-confirm="Supprimer « <?= e($g['titre']) ?> » ?">
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

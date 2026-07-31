<?php
/** Liste admin des codes USSD. Variables : $codes, $actions. */

use App\Core\Csrf;

/** @var array<int,array<string,mixed>> $codes */
/** @var array<string,string> $actions */
?>
<div class="admin-panel-head">
    <input type="search" class="admin-search" data-table="cTable" placeholder="Filtrer les codes…" aria-label="Filtrer">
    <a href="<?= url('/admin/codes/create') ?>" class="btn btn-primary">+ Nouveau code</a>
</div>

<div class="admin-table-scroll">
    <table class="admin-table" id="cTable">
        <thead>
            <tr><th>Opérateur</th><th>Action</th><th>Libellé</th><th>Pattern</th><th>Actions</th></tr>
        </thead>
        <tbody>
            <?php if ($codes === []): ?>
                <tr><td colspan="5" class="empty-sm">Aucun code USSD.</td></tr>
            <?php else: ?>
                <?php foreach ($codes as $c): ?>
                    <tr>
                        <td><strong><?= e($c['operateur_nom']) ?></strong></td>
                        <td><?= e($actions[$c['action']] ?? $c['action']) ?></td>
                        <td><?= e($c['libelle']) ?></td>
                        <td><code><?= e($c['pattern']) ?></code></td>
                        <td class="row-actions">
                            <a href="<?= url('/admin/codes/' . (int) $c['id'] . '/edit') ?>" class="btn btn-ghost btn-sm">Modifier</a>
                            <form action="<?= url('/admin/codes/' . (int) $c['id'] . '/delete') ?>" method="post" class="inline-form js-confirm" data-confirm="Supprimer ce code ?">
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

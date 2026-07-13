<?php
use App\Helpers\Csrf;
use App\Helpers\Sanitize;
/** @var array $tales */
?>
<h1>Contes <a class="btn" href="/admin/tales/new" style="float:right">+ Nouveau conte</a></h1>
<table>
    <thead><tr><th>Titre</th><th>Origine</th><th>Pack</th><th>Niveaux</th><th>Gratuit</th><th>Publié</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($tales as $t): ?>
        <tr>
            <td><strong><?= Sanitize::html($t['title']) ?></strong><br><small><?= Sanitize::html($t['slug']) ?></small></td>
            <td><?= Sanitize::html($t['origin']) ?></td>
            <td><?= Sanitize::html($t['pack_title'] ?? '—') ?></td>
            <td><?= (int)$t['version_count'] ?>/3</td>
            <td><?= $t['is_free'] ? '✓' : '—' ?></td>
            <td><?= $t['published_at'] ? '✓' : '<span class="tag pending">brouillon</span>' ?></td>
            <td>
                <form class="inline" method="post" action="/admin/tales/<?= (int)$t['id'] ?>/delete" onsubmit="return confirm('Supprimer ce conte ?')">
                    <?= Csrf::field() ?>
                    <button class="btn danger" type="submit">Suppr.</button>
                </form>
            </td>
        </tr>
    <?php endforeach; ?>
    <?php if (!$tales): ?><tr><td colspan="7">Aucun conte. Créez-en un.</td></tr><?php endif; ?>
    </tbody>
</table>

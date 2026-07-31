<?php
/**
 * Tableau de bord admin.
 * Variables : $stats, $plusConsultes, $logs.
 */
/** @var array{forfaits:int,operateurs:int,guides:int,generations:int} $stats */
/** @var array<int,array<string,mixed>> $plusConsultes */
/** @var array<int,array<string,mixed>> $logs */
?>
<div class="stats-grid">
    <div class="stat-card stat-orange">
        <span class="stat-ico">📦</span>
        <span class="stat-value"><?= (int) $stats['forfaits'] ?></span>
        <span class="stat-label">Forfaits</span>
    </div>
    <div class="stat-card stat-blue">
        <span class="stat-ico">📡</span>
        <span class="stat-value"><?= (int) $stats['operateurs'] ?></span>
        <span class="stat-label">Opérateurs</span>
    </div>
    <div class="stat-card stat-green">
        <span class="stat-ico">📖</span>
        <span class="stat-value"><?= (int) $stats['guides'] ?></span>
        <span class="stat-label">Guides</span>
    </div>
    <div class="stat-card stat-yellow">
        <span class="stat-ico">＃</span>
        <span class="stat-value"><?= (int) $stats['generations'] ?></span>
        <span class="stat-label">Codes générés</span>
    </div>
</div>

<div class="admin-columns">
    <section class="admin-panel">
        <h2>Forfaits les plus consultés</h2>
        <?php if ($plusConsultes === []): ?>
            <p class="empty-sm">Aucune consultation enregistrée.</p>
        <?php else: ?>
            <table class="admin-table">
                <thead><tr><th>Forfait</th><th>Opérateur</th><th>Prix</th><th>Vues</th></tr></thead>
                <tbody>
                    <?php foreach ($plusConsultes as $f): ?>
                        <tr>
                            <td><?= e($f['nom']) ?></td>
                            <td><span class="op-badge op-badge-sm" style="background: <?= e($f['operateur_couleur']) ?>"><?= e($f['operateur_nom']) ?></span></td>
                            <td><?= fcfa((int) $f['prix']) ?></td>
                            <td><?= (int) ($f['vues'] ?? 0) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </section>

    <section class="admin-panel">
        <h2>Activité récente</h2>
        <?php if ($logs === []): ?>
            <p class="empty-sm">Aucune action enregistrée.</p>
        <?php else: ?>
            <ul class="log-list">
                <?php foreach ($logs as $log): ?>
                    <li>
                        <span class="log-action"><?= e($log['action']) ?></span>
                        <?php if (!empty($log['details'])): ?><span class="log-details"><?= e($log['details']) ?></span><?php endif; ?>
                        <span class="log-meta"><?= e($log['admin_nom'] ?? 'système') ?> · <?= e($log['created_at']) ?></span>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </section>
</div>

<div class="admin-quick-links">
    <a href="<?= url('/admin/forfaits/create') ?>" class="btn btn-primary">+ Nouveau forfait</a>
    <a href="<?= url('/admin/guides/create') ?>" class="btn btn-outline">+ Nouveau guide</a>
    <a href="<?= url('/admin/codes/create') ?>" class="btn btn-outline">+ Nouveau code USSD</a>
</div>

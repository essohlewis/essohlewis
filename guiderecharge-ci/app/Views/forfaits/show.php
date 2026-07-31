<?php
/**
 * Détail d'un forfait.
 * Variables : $forfait, $codes (codes USSD de l'opérateur).
 */
/** @var array<string,mixed> $forfait */
/** @var array<int,array<string,mixed>> $codes */
$couleur = $forfait['operateur_couleur'] ?? '#666';
$hasCode = !empty($forfait['code_ussd']);
?>
<section class="page-head" style="--op-color: <?= e($couleur) ?>">
    <div class="container breadcrumb">
        <a href="<?= url('/forfaits') ?>">← Catalogue</a>
    </div>
    <div class="container detail-head">
        <span class="op-badge" style="background: <?= e($couleur) ?>"><?= e($forfait['operateur_nom']) ?></span>
        <h1><?= e($forfait['nom']) ?></h1>
        <?php if (!empty($forfait['populaire'])): ?><span class="badge-pop">★ Populaire</span><?php endif; ?>
    </div>
</section>

<section class="container detail-body">
    <div class="detail-main">
        <?php if (!empty($forfait['description'])): ?>
            <p class="detail-desc"><?= e($forfait['description']) ?></p>
        <?php endif; ?>

        <div class="detail-specs">
            <?php if (!empty($forfait['volume_data'])): ?>
                <div class="spec-box"><span>🌐 Internet</span><strong><?= e($forfait['volume_data']) ?></strong></div>
            <?php endif; ?>
            <?php if (!empty($forfait['minutes_appel'])): ?>
                <div class="spec-box"><span>📞 Appels</span><strong><?= e($forfait['minutes_appel']) ?></strong></div>
            <?php endif; ?>
            <?php if (!empty($forfait['sms'])): ?>
                <div class="spec-box"><span>✉️ SMS</span><strong><?= e($forfait['sms']) ?></strong></div>
            <?php endif; ?>
            <?php if (!empty($forfait['validite'])): ?>
                <div class="spec-box"><span>⏳ Validité</span><strong><?= e($forfait['validite']) ?></strong></div>
            <?php endif; ?>
            <div class="spec-box"><span>🏷️ Catégorie</span><strong><?= e($forfait['categorie_nom']) ?></strong></div>
        </div>

        <?php if ($hasCode): ?>
            <div class="detail-code-card">
                <h2>Code d'activation</h2>
                <code class="code-big"><?= e($forfait['code_ussd']) ?></code>
                <div class="modal-actions">
                    <button class="btn btn-outline js-copy" data-copy="<?= e($forfait['code_ussd']) ?>">📋 Copier</button>
                    <a class="btn btn-primary" href="tel:<?= e(str_replace('#', '%23', (string) $forfait['code_ussd'])) ?>">📲 Composer</a>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <aside class="detail-aside">
        <div class="detail-prix-card" style="--op-color: <?= e($couleur) ?>">
            <span class="detail-prix-label">Prix</span>
            <span class="detail-prix"><?= fcfa((int) $forfait['prix']) ?></span>
            <a href="<?= url('/comparer?ids=' . (int) $forfait['id']) ?>" class="btn btn-outline btn-block">⚖️ Ajouter au comparateur</a>
        </div>

        <?php if ($codes !== []): ?>
            <div class="aside-codes">
                <h3>Codes utiles <?= e($forfait['operateur_nom']) ?></h3>
                <ul class="codes-list">
                    <?php foreach ($codes as $c): ?>
                        <li>
                            <span class="code-label"><?= e($c['libelle']) ?></span>
                            <code class="code-pattern"><?= e($c['pattern']) ?></code>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
    </aside>
</section>

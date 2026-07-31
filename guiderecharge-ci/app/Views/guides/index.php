<?php
/**
 * Liste des guides.
 * Variables : $guides, $categories, $filtreCat.
 */
/** @var array<int,array<string,mixed>> $guides */
/** @var array<int,string> $categories */
/** @var string $filtreCat */
?>
<section class="page-head">
    <div class="container">
        <h1>Guides & procédures</h1>
        <p>Transfert d'argent, activation de forfait, réclamation, numéros utiles : suivez le pas-à-pas.</p>
    </div>
</section>

<section class="container">
    <?php if ($categories !== []): ?>
        <div class="guide-filters">
            <a href="<?= url('/guides') ?>" class="chip <?= $filtreCat === '' ? 'chip-active' : '' ?>">Tous</a>
            <?php foreach ($categories as $cat): ?>
                <a href="<?= url('/guides?categorie=' . urlencode($cat)) ?>"
                   class="chip <?= $filtreCat === $cat ? 'chip-active' : '' ?>"><?= e($cat) ?></a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>

    <?php if ($guides === []): ?>
        <p class="empty">Aucun guide disponible pour l'instant.</p>
    <?php else: ?>
        <div class="guides-grid">
            <?php foreach ($guides as $g): ?>
                <a class="guide-card" href="<?= url('/guide/' . e($g['slug'])) ?>"
                   style="--op-color: <?= e($g['couleur_hex'] ?? '#0a7d54') ?>">
                    <?php if (!empty($g['categorie'])): ?>
                        <span class="guide-cat"><?= e($g['categorie']) ?></span>
                    <?php endif; ?>
                    <h3><?= e($g['titre']) ?></h3>
                    <p><?= e(excerpt((string) $g['contenu'], 120)) ?></p>
                    <span class="guide-more">Lire le guide →</span>
                </a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>

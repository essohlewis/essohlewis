<?php
/**
 * Détail d'un guide.
 * Variables : $guide, $autres.
 * NB : $guide['contenu'] est un HTML riche déjà nettoyé à l'enregistrement
 * (sanitizeHtml côté admin), il est donc rendu tel quel.
 */
/** @var array<string,mixed> $guide */
/** @var array<int,array<string,mixed>> $autres */
?>
<section class="page-head" style="--op-color: <?= e($guide['couleur_hex'] ?? '#0a7d54') ?>">
    <div class="container breadcrumb">
        <a href="<?= url('/guides') ?>">← Tous les guides</a>
    </div>
    <div class="container">
        <?php if (!empty($guide['categorie'])): ?>
            <span class="guide-cat"><?= e($guide['categorie']) ?></span>
        <?php endif; ?>
        <h1><?= e($guide['titre']) ?></h1>
        <?php if (!empty($guide['operateur_nom'])): ?>
            <span class="op-badge" style="background: <?= e($guide['couleur_hex'] ?? '#666') ?>"><?= e($guide['operateur_nom']) ?></span>
        <?php endif; ?>
    </div>
</section>

<section class="container guide-detail">
    <article class="guide-content">
        <?php if (!empty($guide['image'])): ?>
            <img src="<?= e($guide['image']) ?>" alt="" loading="lazy" class="guide-image">
        <?php endif; ?>
        <?= $guide['contenu'] // HTML riche nettoyé à l'enregistrement ?>
    </article>

    <?php if ($autres !== []): ?>
        <aside class="guide-aside">
            <h3>Autres guides</h3>
            <ul class="aside-links">
                <?php foreach ($autres as $a): ?>
                    <?php if ((int) $a['id'] === (int) $guide['id']) { continue; } ?>
                    <li><a href="<?= url('/guide/' . e($a['slug'])) ?>"><?= e($a['titre']) ?></a></li>
                <?php endforeach; ?>
            </ul>
        </aside>
    <?php endif; ?>
</section>

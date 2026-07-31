<?php
/**
 * Catalogue des forfaits : filtres dynamiques (JS) + grille.
 * Variables : $forfaits, $operateurs, $categories, $filters.
 */
/** @var array<int,array<string,mixed>> $forfaits */
/** @var array<int,array<string,mixed>> $operateurs */
/** @var array<int,array<string,mixed>> $categories */
/** @var array<string,mixed> $filters */
?>
<section class="page-head">
    <div class="container">
        <h1>Catalogue des forfaits</h1>
        <p>Filtrez par opérateur, catégorie et prix. Comparez vos favoris et récupérez le code d'activation.</p>
    </div>
</section>

<section class="container catalogue">
    <!-- Filtres (fonctionnent en JS sans rechargement ; repli GET côté serveur). -->
    <form class="filters" id="filters" method="get" action="<?= url('/forfaits') ?>">
        <div class="filter-group">
            <label for="f-operateur">Opérateur</label>
            <select id="f-operateur" name="operateur">
                <option value="">Tous</option>
                <?php foreach ($operateurs as $op): ?>
                    <option value="<?= e($op['slug']) ?>" <?= ($filters['operateur'] ?? '') === $op['slug'] ? 'selected' : '' ?>>
                        <?= e($op['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="filter-group">
            <label for="f-categorie">Catégorie</label>
            <select id="f-categorie" name="categorie">
                <option value="">Toutes</option>
                <?php foreach ($categories as $cat): ?>
                    <option value="<?= e($cat['slug']) ?>" <?= ($filters['categorie'] ?? '') === $cat['slug'] ? 'selected' : '' ?>>
                        <?= e($cat['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="filter-group">
            <label for="f-prix-min">Prix min (FCFA)</label>
            <input type="number" id="f-prix-min" name="prix_min" min="0" step="50"
                   value="<?= e($filters['prix_min'] ?? '') ?>" placeholder="0">
        </div>
        <div class="filter-group">
            <label for="f-prix-max">Prix max (FCFA)</label>
            <input type="number" id="f-prix-max" name="prix_max" min="0" step="50"
                   value="<?= e($filters['prix_max'] ?? '') ?>" placeholder="∞">
        </div>

        <div class="filter-group">
            <label for="f-sort">Trier</label>
            <select id="f-sort" name="sort">
                <option value="populaire" <?= ($filters['sort'] ?? '') === 'populaire' ? 'selected' : '' ?>>Popularité</option>
                <option value="prix_asc" <?= ($filters['sort'] ?? '') === 'prix_asc' ? 'selected' : '' ?>>Prix croissant</option>
                <option value="prix_desc" <?= ($filters['sort'] ?? '') === 'prix_desc' ? 'selected' : '' ?>>Prix décroissant</option>
                <option value="recent" <?= ($filters['sort'] ?? '') === 'recent' ? 'selected' : '' ?>>Plus récents</option>
            </select>
        </div>

        <button type="button" class="btn btn-ghost btn-sm" id="resetFilters">Réinitialiser</button>
        <noscript><button type="submit" class="btn btn-primary btn-sm">Filtrer</button></noscript>
    </form>

    <div class="catalogue-meta">
        <span id="resultCount"><?= count($forfaits) ?></span> forfait(s)
        <span class="compare-tray" id="compareTray" hidden>
            <span id="compareCount">0</span> sélectionné(s)
            <a href="<?= url('/comparer') ?>" class="btn btn-primary btn-sm" id="compareGo">Comparer →</a>
        </span>
    </div>

    <div class="forfaits-grid" id="forfaitsGrid">
        <?php if ($forfaits === []): ?>
            <p class="empty">Aucun forfait ne correspond à ces critères.</p>
        <?php else: ?>
            <?php foreach ($forfaits as $f): ?>
                <?php require VIEW_PATH . '/forfaits/_card.php'; ?>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
</section>

<!-- Modale d'affichage du code USSD. -->
<div class="modal" id="codeModal" hidden>
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="codeModalTitle">
        <button class="modal-close" id="codeModalClose" aria-label="Fermer">✕</button>
        <h3 id="codeModalTitle">Code d'activation</h3>
        <p class="modal-forfait" id="codeModalNom"></p>
        <code class="code-big" id="codeModalCode"></code>
        <div class="modal-actions">
            <button class="btn btn-outline js-copy" id="codeModalCopy" data-copy="">📋 Copier</button>
            <a class="btn btn-primary" id="codeModalDial" href="#">📲 Composer</a>
        </div>
        <p class="modal-hint">Astuce : certains codes nécessitent de suivre les instructions à l'écran après composition.</p>
    </div>
</div>

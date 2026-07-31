<?php
/**
 * Résultats de la recherche globale.
 * Variables : $term, $results (forfaits/guides/codes), $total.
 */
/** @var string $term */
/** @var array{forfaits:array,guides:array,codes:array} $results */
/** @var int $total */
?>
<section class="page-head">
    <div class="container">
        <h1>Recherche</h1>
        <form class="hero-search" action="<?= url('/recherche') ?>" method="get" role="search">
            <input type="search" name="q" value="<?= e($term) ?>" placeholder="Forfaits, guides, codes…"
                   aria-label="Recherche" autocomplete="off" autofocus>
            <button type="submit" class="btn btn-primary">Rechercher</button>
        </form>
        <?php if ($term !== ''): ?>
            <p class="search-summary"><strong><?= (int) $total ?></strong> résultat(s) pour « <?= e($term) ?> »</p>
        <?php endif; ?>
    </div>
</section>

<section class="container search-results">
    <?php if ($term === ''): ?>
        <p class="empty">Saisissez un terme (au moins 2 caractères) pour lancer la recherche.</p>
    <?php elseif ($total === 0): ?>
        <p class="empty">Aucun résultat. Essayez un autre mot-clé (ex : « internet », « transfert », « solde »).</p>
    <?php else: ?>

        <?php if ($results['forfaits'] !== []): ?>
            <h2 class="search-cat-title">📦 Forfaits (<?= count($results['forfaits']) ?>)</h2>
            <div class="forfaits-grid">
                <?php foreach ($results['forfaits'] as $f): ?>
                    <?php require VIEW_PATH . '/forfaits/_card.php'; ?>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($results['guides'] !== []): ?>
            <h2 class="search-cat-title">📖 Guides (<?= count($results['guides']) ?>)</h2>
            <div class="guides-grid">
                <?php foreach ($results['guides'] as $g): ?>
                    <a class="guide-card" href="<?= url('/guide/' . e($g['slug'])) ?>">
                        <?php if (!empty($g['categorie'])): ?><span class="guide-cat"><?= e($g['categorie']) ?></span><?php endif; ?>
                        <h3><?= e($g['titre']) ?></h3>
                        <p><?= e(excerpt((string) $g['contenu'], 100)) ?></p>
                        <span class="guide-more">Lire →</span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($results['codes'] !== []): ?>
            <h2 class="search-cat-title">＃ Codes USSD (<?= count($results['codes']) ?>)</h2>
            <ul class="codes-list codes-list-flat">
                <?php foreach ($results['codes'] as $c): ?>
                    <li>
                        <span class="code-label"><?= e($c['operateur_nom']) ?> — <?= e($c['libelle']) ?></span>
                        <code class="code-pattern"><?= e($c['pattern']) ?></code>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>

    <?php endif; ?>
</section>

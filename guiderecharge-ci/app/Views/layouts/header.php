<?php
/**
 * En-tête commun du front : barre de navigation + recherche globale.
 * Attend éventuellement $title dans le scope parent.
 */

use App\Core\Session;

$flash = Session::pullFlash();
?>
<header class="site-header">
    <div class="container header-inner">
        <a href="<?= url('/') ?>" class="brand" aria-label="Accueil GuideRecharge CI">
            <span class="brand-mark" aria-hidden="true">📶</span>
            <span class="brand-text">GuideRecharge<span class="brand-ci">CI</span></span>
        </a>

        <button class="nav-toggle" id="navToggle" aria-label="Ouvrir le menu" aria-expanded="false">
            <span></span><span></span><span></span>
        </button>

        <nav class="site-nav" id="siteNav">
            <a href="<?= url('/forfaits') ?>" class="<?= active('/forfaits') ?>">Forfaits</a>
            <a href="<?= url('/comparer') ?>" class="<?= active('/comparer') ?>">Comparer</a>
            <a href="<?= url('/generateur') ?>" class="nav-highlight <?= active('/generateur') ?>">Générer un code</a>
            <a href="<?= url('/guides') ?>" class="<?= active('/guides') ?>">Guides</a>
            <form class="nav-search" action="<?= url('/recherche') ?>" method="get" role="search">
                <input type="search" name="q" placeholder="Rechercher…" aria-label="Recherche globale"
                       value="<?= isset($term) ? e($term) : '' ?>" autocomplete="off">
                <button type="submit" aria-label="Lancer la recherche">🔍</button>
            </form>
            <button class="theme-toggle" id="themeToggle" aria-label="Basculer le thème clair/sombre" title="Thème clair/sombre">🌓</button>
        </nav>
    </div>
</header>

<?php if ($flash !== []): ?>
    <div class="flash-zone container" role="status" aria-live="polite">
        <?php foreach ($flash as $type => $message): ?>
            <div class="flash flash-<?= e($type) ?>"><?= e($message) ?></div>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

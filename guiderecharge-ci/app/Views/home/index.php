<?php
/**
 * Page d'accueil.
 * Variables : $operateurs, $populaires, $categories, $codesEssentiels.
 */
/** @var array<int,array<string,mixed>> $operateurs */
/** @var array<int,array<string,mixed>> $populaires */
/** @var array<string,array<int,array<string,mixed>>> $codesEssentiels */
?>
<section class="hero">
    <div class="container hero-inner">
        <div class="hero-text">
            <h1 class="hero-title">Le bon forfait, le bon code,<br><span>en un clic.</span></h1>
            <p class="hero-sub">
                Comparez les forfaits <strong>Orange</strong>, <strong>MTN</strong> et <strong>Moov</strong>,
                obtenez le <strong>code USSD exact</strong> à composer et lancez l'appel directement.
                Aucun paiement en ligne : juste l'info utile, à jour.
            </p>

            <form class="hero-search" action="<?= url('/recherche') ?>" method="get" role="search">
                <input type="search" name="q" placeholder="Ex : forfait internet 5 Go, transfert crédit…"
                       aria-label="Recherche rapide" autocomplete="off">
                <button type="submit" class="btn btn-primary">Rechercher</button>
            </form>

            <div class="hero-ops" aria-label="Choisir un opérateur">
                <?php foreach ($operateurs as $op): ?>
                    <a class="hero-op-chip" href="<?= url('/forfaits?operateur=' . e($op['slug'])) ?>"
                       style="--op-color: <?= e($op['couleur_hex']) ?>">
                        <?= e($op['nom']) ?>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="hero-quick">
            <a href="<?= url('/generateur') ?>" class="quick-card quick-star">
                <span class="quick-ico">＃</span>
                <span class="quick-title">Générer un code</span>
                <span class="quick-desc">Numéro + montant → code prêt à composer</span>
            </a>
            <a href="<?= url('/comparer') ?>" class="quick-card">
                <span class="quick-ico">⚖️</span>
                <span class="quick-title">Comparer</span>
                <span class="quick-desc">Le meilleur rapport prix/Go</span>
            </a>
            <a href="<?= url('/guides') ?>" class="quick-card">
                <span class="quick-ico">📖</span>
                <span class="quick-title">Guides</span>
                <span class="quick-desc">Transfert, activation, réclamation</span>
            </a>
        </div>
    </div>
</section>

<!-- Forfaits populaires -->
<section class="section container">
    <div class="section-head">
        <h2>Forfaits populaires</h2>
        <a href="<?= url('/forfaits') ?>" class="link-more">Tout le catalogue →</a>
    </div>
    <?php if ($populaires === []): ?>
        <p class="empty">Aucun forfait pour le moment.</p>
    <?php else: ?>
        <div class="forfaits-grid">
            <?php foreach ($populaires as $f): ?>
                <?php require VIEW_PATH . '/forfaits/_card.php'; ?>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>

<!-- Codes essentiels par opérateur -->
<section class="section section-alt">
    <div class="container">
        <div class="section-head">
            <h2>Codes essentiels</h2>
            <a href="<?= url('/generateur') ?>" class="link-more">Générateur complet →</a>
        </div>
        <div class="codes-grid">
            <?php foreach ($codesEssentiels as $slug => $codes): ?>
                <?php $couleur = $codes[0]['couleur_hex'] ?? '#666'; ?>
                <div class="codes-op-card" style="--op-color: <?= e($couleur) ?>">
                    <h3><span class="op-dot" style="background: <?= e($couleur) ?>"></span><?= e($codes[0]['operateur_nom']) ?></h3>
                    <ul class="codes-list">
                        <?php foreach ($codes as $c): ?>
                            <li>
                                <span class="code-label"><?= e($c['libelle']) ?></span>
                                <code class="code-pattern"><?= e($c['pattern']) ?></code>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endforeach; ?>
        </div>
        <p class="codes-note">💡 Les codes avec <code>{numero}</code> ou <code>{montant}</code> se complètent automatiquement dans le <a href="<?= url('/generateur') ?>">générateur</a>.</p>
    </div>
</section>

<!-- Bandeau générateur -->
<section class="section container">
    <div class="cta-banner">
        <div>
            <h2>Trouvez votre code en 10 secondes</h2>
            <p>Saisissez votre numéro, on détecte votre opérateur automatiquement (07 · 05 · 01) et on génère le code exact.</p>
        </div>
        <a href="<?= url('/generateur') ?>" class="btn btn-light btn-lg">Ouvrir le générateur</a>
    </div>
</section>

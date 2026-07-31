<?php
/**
 * Carte forfait réutilisable.
 * Attend une variable $f (tableau associatif du forfait avec jointures).
 */
/** @var array<string,mixed> $f */
$couleur = $f['operateur_couleur'] ?? '#666';
?>
<article class="forfait-card" data-operateur="<?= e($f['operateur_slug']) ?>"
         data-categorie="<?= e($f['categorie_slug'] ?? '') ?>" data-prix="<?= (int) $f['prix'] ?>"
         style="--op-color: <?= e($couleur) ?>">
    <header class="forfait-card-head">
        <span class="op-badge" style="background: <?= e($couleur) ?>"><?= e($f['operateur_nom']) ?></span>
        <?php if (!empty($f['populaire'])): ?>
            <span class="badge-pop">★ Populaire</span>
        <?php endif; ?>
    </header>

    <h3 class="forfait-nom"><?= e($f['nom']) ?></h3>
    <?php if (!empty($f['categorie_nom'])): ?>
        <span class="forfait-cat"><?= e($f['categorie_icone'] ?? '') ?> <?= e($f['categorie_nom']) ?></span>
    <?php endif; ?>

    <div class="forfait-specs">
        <?php if (!empty($f['volume_data'])): ?>
            <span class="spec"><span class="spec-ico">🌐</span><?= e($f['volume_data']) ?></span>
        <?php endif; ?>
        <?php if (!empty($f['minutes_appel'])): ?>
            <span class="spec"><span class="spec-ico">📞</span><?= e($f['minutes_appel']) ?></span>
        <?php endif; ?>
        <?php if (!empty($f['sms'])): ?>
            <span class="spec"><span class="spec-ico">✉️</span><?= e($f['sms']) ?></span>
        <?php endif; ?>
        <?php if (!empty($f['validite'])): ?>
            <span class="spec"><span class="spec-ico">⏳</span><?= e($f['validite']) ?></span>
        <?php endif; ?>
    </div>

    <div class="forfait-prix"><?= fcfa((int) $f['prix']) ?></div>

    <div class="forfait-actions">
        <?php if (!empty($f['code_ussd'])): ?>
            <button type="button" class="btn btn-outline btn-sm js-voir-code"
                    data-code="<?= e($f['code_ussd']) ?>" data-nom="<?= e($f['nom']) ?>">
                Voir le code
            </button>
            <a class="btn btn-primary btn-sm" href="tel:<?= e(str_replace('#', '%23', (string) $f['code_ussd'])) ?>">
                📲 Composer
            </a>
        <?php else: ?>
            <a class="btn btn-outline btn-sm" href="<?= url('/forfait/' . (int) $f['id']) ?>">Détails</a>
        <?php endif; ?>
    </div>

    <label class="compare-check">
        <input type="checkbox" class="js-compare-toggle" value="<?= (int) $f['id'] ?>"
               data-nom="<?= e($f['nom']) ?>"> Comparer
    </label>
</article>

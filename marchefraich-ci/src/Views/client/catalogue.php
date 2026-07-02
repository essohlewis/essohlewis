<?php /** @var array $marche @var array $vendeuses */ ?>
<h1>🏪 <?= e($marche['nom']) ?></h1>
<p class="sous-titre"><?= e($marche['quartier']) ?>, <?= e($marche['ville']) ?></p>

<h2>Vendeuses du marché</h2>
<div class="grille">
  <?php if (!$vendeuses): ?>
    <div class="carte muted">Aucune vendeuse validée pour l'instant sur ce marché.</div>
  <?php endif; ?>
  <?php foreach ($vendeuses as $v): ?>
    <a class="carte carte-lien" href="<?= lien('/client/boutique/' . $v['id']) ?>">
      <div style="display:flex;gap:.8rem;align-items:center">
        <?php if (!empty($v['photo_etal'])): ?>
          <img class="produit-photo" style="width:72px;height:72px;aspect-ratio:1" src="<?= asset($v['photo_etal']) ?>" alt="Étal de <?= e($v['nom']) ?>">
        <?php else: ?>
          <div class="produit-photo" style="width:72px;height:72px;aspect-ratio:1">🧺</div>
        <?php endif; ?>
        <div>
          <strong><?= e($v['nom']) ?></strong>
          <div class="muted"><?= e($v['description'] ?? '') ?></div>
          <span class="pastille"><?= (int) $v['nb_produits'] ?> produit(s)</span>
        </div>
      </div>
    </a>
  <?php endforeach; ?>
</div>

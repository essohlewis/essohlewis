<?php /** @var array $client @var array $marches */ ?>
<h1>Bonjour <?= e($client['nom']) ?> 👋</h1>
<p class="sous-titre">Choisissez un marché pour découvrir les vendeuses et leurs produits.</p>

<div class="grille">
  <?php if (!$marches): ?>
    <div class="carte muted">Aucun marché actif pour le moment.</div>
  <?php endif; ?>
  <?php foreach ($marches as $m): ?>
    <a class="carte carte-lien" href="<?= lien('/client/marche/' . $m['id']) ?>">
      <strong>🏪 <?= e($m['nom']) ?></strong>
      <div class="muted"><?= e($m['quartier']) ?>, <?= e($m['ville']) ?></div>
    </a>
  <?php endforeach; ?>
</div>

<?php /** @var array $vendeuse @var array $produits */ use App\Core\Session; ?>
<h1><?= e($vendeuse['nom']) ?></h1>
<p class="sous-titre"><?= e($vendeuse['description'] ?? '') ?> — <?= e($vendeuse['marche_nom']) ?></p>

<?php if (!$produits): ?>
  <div class="carte muted">Cette vendeuse n'a pas encore de produit disponible.</div>
<?php endif; ?>

<div class="grille grille-2">
  <?php foreach ($produits as $p): ?>
    <div class="carte">
      <?php if (!empty($p['photo'])): ?>
        <img class="produit-photo" src="<?= asset($p['photo']) ?>" alt="<?= e($p['nom']) ?>">
      <?php else: ?>
        <div class="produit-photo">🥬</div>
      <?php endif; ?>
      <strong><?= e($p['nom']) ?></strong>
      <?php if (!empty($p['categorie'])): ?><div class="muted"><?= e($p['categorie']) ?></div><?php endif; ?>
      <div class="prix"><?= xof((int) $p['prix_xof']) ?> <span class="unite">/ <?= e($p['unite']) ?></span></div>
      <?php if ((int) $p['quantite_disponible'] <= 5): ?>
        <div class="stock-bas">Plus que <?= (int) $p['quantite_disponible'] ?> en stock</div>
      <?php endif; ?>

      <form method="post" action="<?= lien('/client/panier/ajouter') ?>" class="mt">
        <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
        <input type="hidden" name="produit_id" value="<?= (int) $p['id'] ?>">
        <div class="qte">
          <button type="button" class="bouton secondaire petit" data-qte="moins" data-cible="q<?= (int) $p['id'] ?>">−</button>
          <input type="number" id="q<?= (int) $p['id'] ?>" name="quantite" value="1" min="1" max="<?= (int) $p['quantite_disponible'] ?>">
          <button type="button" class="bouton secondaire petit" data-qte="plus" data-cible="q<?= (int) $p['id'] ?>">+</button>
        </div>
        <button type="submit" class="bouton orange pleine-largeur mt">Ajouter 🛒</button>
      </form>
    </div>
  <?php endforeach; ?>
</div>

<p class="centre mt"><a class="bouton secondaire" href="<?= lien('/client/marche/' . $vendeuse['marche_id']) ?>">← Autres vendeuses</a></p>

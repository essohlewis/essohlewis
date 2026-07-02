<?php /** @var array $produits */ use App\Core\Session; ?>
<h1>🥬 Mes produits</h1>
<a class="bouton pleine-largeur" href="<?= lien('/vendeuse/produits/ajouter') ?>">➕ Ajouter un produit</a>

<?php if (!$produits): ?>
  <div class="carte muted mt">Vous n'avez pas encore de produit. Ajoutez-en un pour commencer à vendre.</div>
<?php endif; ?>

<div class="mt">
<?php foreach ($produits as $p): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0">
      <div style="display:flex;gap:.7rem;align-items:center">
        <?php if (!empty($p['photo'])): ?>
          <img class="produit-photo" style="width:56px;height:56px;aspect-ratio:1" src="<?= asset($p['photo']) ?>" alt="">
        <?php else: ?>
          <div class="produit-photo" style="width:56px;height:56px;aspect-ratio:1">🥬</div>
        <?php endif; ?>
        <div>
          <strong><?= e($p['nom']) ?></strong>
          <div class="prix"><?= xof((int) $p['prix_xof']) ?> <span class="unite">/ <?= e($p['unite']) ?></span></div>
          <div class="muted">Stock : <?= (int) $p['quantite_disponible'] ?>
            <?php if ((int) $p['actif'] !== 1): ?><span class="badge annulee">Masqué</span><?php endif; ?>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem">
        <a class="bouton secondaire petit" href="<?= lien('/vendeuse/produits/' . $p['id'] . '/modifier') ?>">Modifier</a>
        <form method="post" action="<?= lien('/vendeuse/produits/' . $p['id'] . '/supprimer') ?>" data-confirmer="Supprimer ce produit ?">
          <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
          <button class="bouton danger petit" type="submit">Supprimer</button>
        </form>
      </div>
    </div>
  </div>
<?php endforeach; ?>
</div>

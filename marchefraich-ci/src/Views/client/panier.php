<?php /** @var array $lignes @var ?array $vendeuse @var array $totaux */ use App\Core\Session; ?>
<h1>🛒 Mon panier</h1>

<?php if (!$lignes): ?>
  <div class="carte centre">
    <p>Votre panier est vide.</p>
    <a class="bouton" href="<?= lien('/client') ?>">Voir les marchés</a>
  </div>
<?php else: ?>
  <p class="sous-titre">Vendeuse : <strong><?= e($vendeuse['nom']) ?></strong></p>

  <div class="carte">
    <?php foreach ($lignes as $l): ?>
      <div class="ligne">
        <div>
          <strong><?= e($l['produit']['nom']) ?></strong>
          <div class="muted"><?= xof((int) $l['produit']['prix_xof']) ?> / <?= e($l['produit']['unite']) ?></div>
        </div>
        <div style="text-align:right">
          <form method="post" action="<?= lien('/client/panier/maj') ?>" class="qte" style="justify-content:flex-end">
            <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
            <input type="hidden" name="produit_id" value="<?= (int) $l['produit']['id'] ?>">
            <input type="number" name="quantite" value="<?= (int) $l['quantite'] ?>" min="1" max="<?= (int) $l['produit']['quantite_disponible'] ?>" style="width:60px">
            <button class="bouton secondaire petit" type="submit">OK</button>
          </form>
          <div class="prix mt"><?= xof($l['sous_total']) ?></div>
          <form method="post" action="<?= lien('/client/panier/maj') ?>">
            <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
            <input type="hidden" name="produit_id" value="<?= (int) $l['produit']['id'] ?>">
            <input type="hidden" name="action" value="retirer">
            <button class="bouton danger petit mt" type="submit">Retirer</button>
          </form>
        </div>
      </div>
    <?php endforeach; ?>
  </div>

  <div class="carte recap">
    <div class="ligne"><span>Sous-total produits</span><span><?= xof($totaux['produits']) ?></span></div>
    <div class="ligne"><span>Frais de livraison</span><span><?= xof($totaux['livraison']) ?></span></div>
    <div class="ligne total"><span>Total à payer</span><span><?= xof($totaux['total']) ?></span></div>
  </div>

  <a class="bouton pleine-largeur" href="<?= lien('/client/commander') ?>">Passer la commande</a>
<?php endif; ?>

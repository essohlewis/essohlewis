<?php /** @var array $commande @var array $lignes */ use App\Core\Session; ?>
<h1>Commande <?= e($commande['reference']) ?></h1>
<p class="sous-titre">
  <span class="badge <?= e($commande['statut']) ?>"><?= e(libelleStatut($commande['statut'])) ?></span>
  <span class="badge <?= e($commande['statut_paiement']) ?>">Paiement : <?= e($commande['statut_paiement']) ?></span>
</p>

<div class="carte">
  <p><strong>Client :</strong> <?= e($commande['client_nom']) ?> — <?= e($commande['client_tel']) ?></p>
  <p><strong>Livraison :</strong> <?= e($commande['adresse_livraison']) ?><?= $commande['quartier_livraison'] ? ', ' . e($commande['quartier_livraison']) : '' ?></p>
  <?php if (!empty($commande['notes'])): ?><p><strong>Note :</strong> <?= e($commande['notes']) ?></p><?php endif; ?>
  <?php if (!empty($commande['coursier_nom'])): ?><p><strong>Coursier :</strong> <?= e($commande['coursier_nom']) ?></p><?php endif; ?>
</div>

<div class="carte">
  <h2 style="margin-top:0">Produits à préparer</h2>
  <?php foreach ($lignes as $l): ?>
    <div class="ligne">
      <span><strong><?= (int) $l['quantite'] ?> ×</strong> <?= e($l['nom_produit']) ?></span>
      <span><?= xof((int) $l['sous_total_xof']) ?></span>
    </div>
  <?php endforeach; ?>
  <div class="ligne total" style="font-weight:800"><span>Total produits</span><span><?= xof((int) $commande['montant_produits_xof']) ?></span></div>
</div>

<?php if (in_array($commande['statut'], ['recue', 'en_preparation'], true)): ?>
  <div class="carte">
    <h2 style="margin-top:0">Mettre à jour</h2>
    <?php if ($commande['statut'] === 'recue'): ?>
      <form method="post" action="<?= lien('/vendeuse/commande/' . $commande['id'] . '/statut') ?>">
        <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
        <input type="hidden" name="statut" value="en_preparation">
        <button class="bouton orange pleine-largeur" type="submit">🧑‍🍳 Marquer « En préparation »</button>
      </form>
    <?php else: ?>
      <p class="muted">Préparation en cours. Un coursier viendra récupérer la commande pour la livraison.</p>
    <?php endif; ?>
    <form method="post" action="<?= lien('/vendeuse/commande/' . $commande['id'] . '/statut') ?>" class="mt" data-confirmer="Annuler cette commande ?">
      <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
      <input type="hidden" name="statut" value="annulee">
      <button class="bouton danger pleine-largeur" type="submit">Annuler la commande</button>
    </form>
  </div>
<?php endif; ?>

<p class="centre"><a class="bouton secondaire" href="<?= lien('/vendeuse') ?>">← Tableau de bord</a></p>

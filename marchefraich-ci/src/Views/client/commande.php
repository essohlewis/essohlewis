<?php /** @var array $commande @var array $lignes */
$etapes = ['recue' => 'Reçue', 'en_preparation' => 'En préparation', 'en_livraison' => 'En livraison', 'livree' => 'Livrée'];
$ordre = array_keys($etapes);
$indexActuel = array_search($commande['statut'], $ordre, true);
$annulee = $commande['statut'] === 'annulee';
?>
<h1>Commande <?= e($commande['reference']) ?></h1>
<p class="sous-titre">
  <span id="statut-actuel" data-statut="<?= e($commande['statut']) ?>" class="badge <?= e($commande['statut']) ?>"><?= e(libelleStatut($commande['statut'])) ?></span>
  <span class="badge <?= e($commande['statut_paiement']) ?>">Paiement : <?= e($commande['statut_paiement']) ?></span>
</p>

<?php if ($annulee): ?>
  <div class="flash erreur">Cette commande a été annulée.</div>
<?php else: ?>
  <div class="carte" data-suivi-url="<?= lien('/client/commande/' . $commande['id'] . '/statut') ?>">
    <ul class="timeline">
      <?php foreach ($etapes as $cle => $libelle): ?>
        <?php $fait = $indexActuel !== false && array_search($cle, $ordre, true) <= $indexActuel; ?>
        <li class="<?= $fait ? 'fait' : '' ?>"><?= e($libelle) ?></li>
      <?php endforeach; ?>
    </ul>
    <?php if (!empty($commande['coursier_nom'])): ?>
      <p class="muted">🛵 Livreur : <strong><?= e($commande['coursier_nom']) ?></strong> — <?= e($commande['coursier_tel']) ?></p>
    <?php endif; ?>
  </div>
<?php endif; ?>

<div class="carte">
  <h2 style="margin-top:0">Détail</h2>
  <?php foreach ($lignes as $l): ?>
    <div class="ligne">
      <span><?= (int) $l['quantite'] ?> × <?= e($l['nom_produit']) ?></span>
      <span><?= xof((int) $l['sous_total_xof']) ?></span>
    </div>
  <?php endforeach; ?>
  <div class="ligne"><span>Livraison</span><span><?= xof((int) $commande['frais_livraison_xof']) ?></span></div>
  <div class="ligne total" style="font-weight:800;border-top:2px solid #000;padding-top:.5rem"><span>Total</span><span><?= xof((int) $commande['montant_total_xof']) ?></span></div>
  <p class="muted mt">Vendeuse : <?= e($commande['vendeuse_nom']) ?> — <?= e($commande['vendeuse_tel']) ?></p>
  <p class="muted">Livraison à : <?= e($commande['adresse_livraison']) ?><?= $commande['quartier_livraison'] ? ', ' . e($commande['quartier_livraison']) : '' ?></p>
  <p class="muted">Mode : <?= e(libelleMethode($commande['mode_paiement'] === 'especes' ? 'especes' : 'orange_money')) ?></p>
</div>

<p class="centre"><a class="bouton secondaire" href="<?= lien('/client/commandes') ?>">← Mes commandes</a></p>

<?php /** @var array $commandes */ ?>
<h1>📦 Mes commandes</h1>

<?php if (!$commandes): ?>
  <div class="carte centre">
    <p>Vous n'avez pas encore passé de commande.</p>
    <a class="bouton" href="<?= lien('/client') ?>">Commander maintenant</a>
  </div>
<?php endif; ?>

<?php foreach ($commandes as $c): ?>
  <a class="carte carte-lien" href="<?= lien('/client/commande/' . $c['id']) ?>">
    <div class="ligne" style="border:none;padding:0">
      <div>
        <strong><?= e($c['reference']) ?></strong>
        <div class="muted"><?= e($c['vendeuse_nom']) ?> · <?= e(date('d/m/Y H:i', strtotime($c['cree_le']))) ?></div>
      </div>
      <div style="text-align:right">
        <span class="badge <?= e($c['statut']) ?>"><?= e(libelleStatut($c['statut'])) ?></span>
        <div class="prix mt"><?= xof((int) $c['montant_total_xof']) ?></div>
      </div>
    </div>
  </a>
<?php endforeach; ?>

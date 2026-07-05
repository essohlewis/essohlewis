<?php /** @var array $vendeuse @var array $commandes @var array $revenus @var bool $validee */ ?>
<h1>Bonjour <?= e($vendeuse['nom']) ?> 👋</h1>

<?php if (!$validee): ?>
  <div class="flash info">Votre boutique est <strong>en attente de validation</strong> par l'administrateur. Vous pouvez déjà préparer vos produits ; ils deviendront visibles aux clients une fois validée.</div>
<?php endif; ?>

<div class="grille grille-2">
  <div class="carte centre">
    <div class="muted">Commandes aujourd'hui</div>
    <div style="font-size:2rem;font-weight:800"><?= (int) $revenus['nb'] ?></div>
  </div>
  <div class="carte centre">
    <div class="muted">Revenus du jour</div>
    <div style="font-size:1.5rem;font-weight:800;color:var(--orange)"><?= xof((int) $revenus['total']) ?></div>
  </div>
</div>

<div class="centre mt">
  <a class="bouton" href="<?= lien('/vendeuse/produits/ajouter') ?>">➕ Ajouter un produit</a>
</div>

<h2>Commandes du jour</h2>
<?php if (!$commandes): ?>
  <div class="carte muted">Aucune commande aujourd'hui.</div>
<?php endif; ?>
<?php foreach ($commandes as $c): ?>
  <a class="carte carte-lien" href="<?= lien('/vendeuse/commande/' . $c['id']) ?>">
    <div class="ligne" style="border:none;padding:0">
      <div>
        <strong><?= e($c['reference']) ?></strong>
        <div class="muted"><?= e($c['client_nom']) ?> · <?= e(date('H:i', strtotime($c['cree_le']))) ?></div>
      </div>
      <div style="text-align:right">
        <span class="badge <?= e($c['statut']) ?>"><?= e(libelleStatut($c['statut'])) ?></span>
        <div class="prix mt"><?= xof((int) $c['montant_produits_xof']) ?></div>
      </div>
    </div>
  </a>
<?php endforeach; ?>

<?php /** @var array $marches */ ?>
<section class="hero">
  <h1>🧺 Le marché de quartier, livré chez vous</h1>
  <p>Commandez vos vivriers et produits frais auprès des vendeuses de votre marché. Paiement Mobile Money ou espèces à la livraison.</p>
</section>

<h2>Je suis…</h2>
<div class="roles">
  <a class="role-carte" href="<?= lien('/connexion') ?>">
    <span class="emoji">🛒</span>
    <span><strong>Client</strong><span class="muted">Commander des produits frais</span></span>
  </a>
  <a class="role-carte" href="<?= lien('/vendeuse/connexion') ?>">
    <span class="emoji">👩🏾‍🌾</span>
    <span><strong>Vendeuse</strong><span class="muted">Gérer ma boutique et mes commandes</span></span>
  </a>
  <a class="role-carte" href="<?= lien('/coursier/connexion') ?>">
    <span class="emoji">🛵</span>
    <span><strong>Coursier</strong><span class="muted">Prendre des courses à livrer</span></span>
  </a>
  <a class="role-carte" href="<?= lien('/admin/connexion') ?>">
    <span class="emoji">⚙️</span>
    <span><strong>Administrateur</strong><span class="muted">Gérer la plateforme</span></span>
  </a>
</div>

<?php if ($marches): ?>
  <h2>Marchés disponibles</h2>
  <div class="grille">
    <?php foreach ($marches as $m): ?>
      <div class="carte">
        <strong>🏪 <?= e($m['nom']) ?></strong>
        <div class="muted"><?= e($m['quartier']) ?>, <?= e($m['ville']) ?></div>
      </div>
    <?php endforeach; ?>
  </div>
  <p class="centre muted mt">Connectez-vous en tant que client pour commander.</p>
<?php endif; ?>

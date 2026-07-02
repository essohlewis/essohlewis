<?php /** @var array $coursier @var array $mesCourses @var array $disponibles */ use App\Core\Session;
$dispo = (int) $coursier['disponible'] === 1;
?>
<h1>🛵 Espace coursier</h1>
<div class="carte">
  <div class="ligne" style="border:none;padding:0">
    <div>
      <strong><?= e($coursier['nom']) ?></strong>
      <div class="muted">Statut : <?= $dispo ? '🟢 Disponible' : '⚪ Indisponible' ?></div>
    </div>
    <form method="post" action="<?= lien('/coursier/disponibilite') ?>">
      <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
      <button class="bouton <?= $dispo ? 'danger' : '' ?> petit" type="submit"><?= $dispo ? 'Me mettre indispo' : 'Me rendre dispo' ?></button>
    </form>
  </div>
</div>

<h2>Mes courses en cours</h2>
<?php $enCours = array_filter($mesCourses, fn($c) => in_array($c['statut'], ['recue','en_preparation','en_livraison'], true)); ?>
<?php if (!$enCours): ?>
  <div class="carte muted">Aucune course en cours.</div>
<?php endif; ?>
<?php foreach ($enCours as $c): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0 0 .5rem">
      <strong><?= e($c['reference']) ?></strong>
      <span class="badge <?= e($c['statut']) ?>"><?= e(libelleStatut($c['statut'])) ?></span>
    </div>
    <p class="muted" style="margin:.2rem 0">📦 <?= e($c['vendeuse_nom']) ?> → 🏠 <?= e($c['client_nom']) ?> (<?= e($c['client_tel']) ?>)</p>
    <p class="muted" style="margin:.2rem 0">📍 <?= e($c['adresse_livraison']) ?><?= $c['quartier_livraison'] ? ', ' . e($c['quartier_livraison']) : '' ?></p>
    <div class="prix"><?= xof((int) $c['montant_total_xof']) ?>
      <span class="unite"><?= $c['mode_paiement'] === 'especes' ? '· à encaisser en espèces' : '· déjà payé' ?></span>
    </div>
    <form method="post" action="<?= lien('/coursier/course/' . $c['id'] . '/terminer') ?>" class="mt" data-confirmer="Confirmer la livraison ?">
      <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
      <input type="hidden" name="statut" value="livree">
      <button class="bouton pleine-largeur" type="submit">✅ Marquer comme livrée</button>
    </form>
  </div>
<?php endforeach; ?>

<h2>Courses disponibles</h2>
<?php if (!$disponibles): ?>
  <div class="carte muted">Aucune course à prendre pour le moment.</div>
<?php endif; ?>
<?php foreach ($disponibles as $c): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0 0 .5rem">
      <strong><?= e($c['reference']) ?></strong>
      <span class="badge <?= e($c['statut']) ?>"><?= e(libelleStatut($c['statut'])) ?></span>
    </div>
    <p class="muted" style="margin:.2rem 0">📦 <?= e($c['vendeuse_nom']) ?> — <?= e($c['marche_nom']) ?></p>
    <p class="muted" style="margin:.2rem 0">📍 Livraison : <?= e($c['adresse_livraison']) ?><?= $c['quartier_livraison'] ? ', ' . e($c['quartier_livraison']) : '' ?></p>
    <div class="prix"><?= xof((int) $c['montant_total_xof']) ?></div>
    <?php if ($dispo): ?>
      <form method="post" action="<?= lien('/coursier/course/' . $c['id'] . '/accepter') ?>" class="mt">
        <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
        <button class="bouton orange pleine-largeur" type="submit">Accepter cette course</button>
      </form>
    <?php else: ?>
      <p class="champ-aide">Rendez-vous disponible pour accepter des courses.</p>
    <?php endif; ?>
  </div>
<?php endforeach; ?>

<p class="centre mt"><a href="<?= lien('/coursier/deconnexion') ?>">Déconnexion</a></p>

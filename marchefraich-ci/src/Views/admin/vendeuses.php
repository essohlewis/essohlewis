<?php /** @var array $vendeuses */ use App\Core\Session; ?>
<h1>👩🏾‍🌾 Vendeuses</h1>
<p class="sous-titre">Validez les nouvelles vendeuses pour rendre leur boutique visible aux clients.</p>

<?php if (!$vendeuses): ?>
  <div class="carte muted">Aucune vendeuse inscrite.</div>
<?php endif; ?>

<?php foreach ($vendeuses as $v): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0 0 .5rem">
      <div>
        <strong><?= e($v['nom']) ?></strong>
        <span class="badge <?= $v['statut'] === 'validee' ? 'livree' : ($v['statut'] === 'suspendue' ? 'annulee' : 'en_attente') ?>">
          <?= e(ucfirst(str_replace('_', ' ', $v['statut']))) ?>
        </span>
        <div class="muted"><?= e($v['telephone']) ?> · <?= e($v['marche_nom']) ?></div>
        <?php if (!empty($v['description'])): ?><div class="muted"><?= e($v['description']) ?></div><?php endif; ?>
      </div>
    </div>
    <form method="post" action="<?= lien('/admin/vendeuses') ?>" style="display:flex;gap:.4rem;flex-wrap:wrap">
      <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
      <input type="hidden" name="vendeuse_id" value="<?= (int) $v['id'] ?>">
      <?php if ($v['statut'] !== 'validee'): ?>
        <button class="bouton petit" type="submit" name="statut" value="validee">Valider</button>
      <?php endif; ?>
      <?php if ($v['statut'] !== 'suspendue'): ?>
        <button class="bouton danger petit" type="submit" name="statut" value="suspendue">Suspendre</button>
      <?php endif; ?>
      <?php if ($v['statut'] === 'suspendue'): ?>
        <button class="bouton secondaire petit" type="submit" name="statut" value="en_attente">Réactiver (en attente)</button>
      <?php endif; ?>
    </form>
  </div>
<?php endforeach; ?>

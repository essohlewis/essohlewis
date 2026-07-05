<?php /** @var array $coursiers */ ?>
<h1>🛵 Coursiers</h1>

<?php if (!$coursiers): ?>
  <div class="carte muted">Aucun coursier inscrit.</div>
<?php endif; ?>

<?php foreach ($coursiers as $c): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0">
      <div>
        <strong><?= e($c['nom']) ?></strong>
        <div class="muted"><?= e($c['telephone']) ?><?= $c['zone'] ? ' · ' . e($c['zone']) : '' ?></div>
      </div>
      <span class="badge <?= (int) $c['disponible'] === 1 ? 'livree' : 'en_attente' ?>">
        <?= (int) $c['disponible'] === 1 ? 'Disponible' : 'Indisponible' ?>
      </span>
    </div>
  </div>
<?php endforeach; ?>

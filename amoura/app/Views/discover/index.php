<?php
/** @var int $admirers_count */
/** @var bool $is_premium */
$scripts = ['discover.js'];
?>
<div class="row between" style="margin-bottom:16px">
  <h1><?= e(t('nav.discover')) ?></h1>
  <div class="row">
    <a href="/likes" class="btn btn-ghost btn-sm">❤️ <?= (int) $admirers_count ?></a>
    <a href="/visitors" class="btn btn-ghost btn-sm" title="<?= e(t('visitors.title')) ?>">👀</a>
    <button class="btn btn-ghost btn-sm" data-toggle="filterPanel">⚙️</button>
  </div>
</div>

<?php if (($onboarding['completion'] ?? 100) < 100): ?>
  <div class="card" style="margin-bottom:16px;background:var(--gradient-brand-soft)">
    <div class="row between">
      <h3 style="margin:0"><?= e(t('onboard.title')) ?></h3>
      <b><?= (int) $onboarding['completion'] ?>%</b>
    </div>
    <p class="muted" style="margin:4px 0 10px"><?= e(t('onboard.subtitle')) ?></p>
    <div class="completion-bar" style="margin-bottom:12px"><i style="width:<?= (int) $onboarding['completion'] ?>%"></i></div>
    <div class="row wrap">
      <?php foreach ($onboarding['steps'] as $step): ?>
        <a href="<?= e($step['url']) ?>" class="chip" style="<?= $step['done'] ? 'opacity:.55;text-decoration:line-through' : '' ?>">
          <?= $step['done'] ? '✅' : '⬜' ?> <?= e($step['label']) ?>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<div id="filterPanel" class="card hidden" style="margin-bottom:16px">
  <form id="discoverFilters" class="row wrap" style="align-items:flex-end">
    <div class="field" style="margin:0"><label>Genre</label>
      <select class="select" name="gender">
        <option value="">Tous</option><option value="female">Femmes</option>
        <option value="male">Hommes</option><option value="nonbinary">Non-binaire</option>
      </select></div>
    <div class="field" style="margin:0"><label>Âge min</label><input class="input" type="number" name="min_age" min="18" max="99" style="width:90px"></div>
    <div class="field" style="margin:0"><label>Âge max</label><input class="input" type="number" name="max_age" min="18" max="99" style="width:90px"></div>
    <div class="field" style="margin:0"><label>Ville</label><input class="input" name="city" style="width:130px"></div>
    <div class="field" style="margin:0"><label>Distance (km)</label><input class="input" type="number" name="distance_km" min="1" style="width:110px" <?= $is_premium ? '' : 'disabled title="Premium"' ?>></div>
    <button class="btn btn-primary">Appliquer</button>
  </form>
</div>

<div class="discover-stage" id="discoverStage">
  <div class="swipe-card skeleton"></div>
</div>

<div class="discover-actions">
  <button class="action-btn pass" data-swipe="pass" title="Passer">✕</button>
  <button class="action-btn superlike" data-swipe="superlike" title="Super Like">★</button>
  <button class="action-btn like" data-swipe="like" title="J'aime">❤</button>
</div>
<style>.hidden{display:none}</style>

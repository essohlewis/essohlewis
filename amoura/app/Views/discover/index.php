<?php
/** @var int $admirers_count */
/** @var bool $is_premium */
$scripts = ['discover.js'];
?>
<div class="row between" style="margin-bottom:16px">
  <h1>Découvrir</h1>
  <div class="row">
    <a href="/likes" class="btn btn-ghost btn-sm">❤️ <?= (int) $admirers_count ?> j'aime</a>
    <button class="btn btn-ghost btn-sm" data-toggle="filterPanel">⚙️ Filtres</button>
  </div>
</div>

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

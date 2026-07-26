<?php /** @var array $admirers */ /** @var bool $is_premium */ ?>
<h1 style="margin-bottom:16px">Ils vous ont liké</h1>
<?php if (empty($admirers)): ?>
  <div class="card text-center"><p class="muted">Personne pour l'instant. Continuez à découvrir des profils !</p></div>
<?php else: ?>
  <div class="photo-grid">
    <?php foreach ($admirers as $a): ?>
      <a class="cell" href="<?= $is_premium ? '/u/' . (int) $a['id'] : '/premium' ?>">
        <img src="<?= e($a['avatar']) ?>" alt="" loading="lazy" style="<?= $is_premium ? '' : 'filter:blur(14px)' ?>">
        <div class="overlay" style="position:absolute;inset:0;display:flex;align-items:flex-end;padding:10px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.6))">
          <?= $is_premium ? e($a['display_name']) . ($a['age'] ? ', ' . $a['age'] : '') : '🔒 Premium' ?>
        </div>
      </a>
    <?php endforeach; ?>
  </div>
  <?php if (!$is_premium): ?>
    <div class="card text-center" style="margin-top:24px">
      <h3>Voyez qui vous a liké 👀</h3>
      <p class="muted">Passez Premium pour révéler tous vos admirateurs.</p>
      <a href="/premium" class="btn btn-primary" style="margin-top:12px">Découvrir Premium</a>
    </div>
  <?php endif; ?>
<?php endif; ?>

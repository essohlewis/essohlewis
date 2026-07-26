<?php /** @var array $viewers */ /** @var int $total */ /** @var bool $is_premium */ ?>
<div class="row between" style="margin-bottom:16px">
  <h1><?= e(t('visitors.title')) ?></h1>
  <span class="badge"><?= e(t('visitors.count', ['n' => $total])) ?></span>
</div>

<?php if (empty($viewers)): ?>
  <div class="card text-center"><p class="muted"><?= e(t('visitors.empty')) ?></p></div>
<?php else: ?>
  <div class="photo-grid">
    <?php foreach ($viewers as $v): ?>
      <a class="cell" href="<?= $is_premium ? '/u/' . (int) $v['id'] : '/premium' ?>">
        <img src="<?= e($v['avatar']) ?>" alt="" loading="lazy" style="<?= $is_premium ? '' : 'filter:blur(14px)' ?>">
        <div class="overlay" style="position:absolute;inset:0;display:flex;align-items:flex-end;padding:10px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.65))">
          <?php if ($is_premium): ?>
            <div>
              <div style="font-weight:700"><?= e($v['display_name']) ?><?= $v['age'] ? ', ' . (int) $v['age'] : '' ?>
                <?= !empty($v['is_verified']) ? '<span class="badge badge-verified">✓</span>' : '' ?></div>
              <div style="font-size:.75rem;opacity:.85"><?= e(time_ago($v['last_viewed_at'])) ?></div>
            </div>
          <?php else: ?>🔒 <?= e(t('common.premium')) ?><?php endif; ?>
        </div>
      </a>
    <?php endforeach; ?>
  </div>
  <?php if (!$is_premium): ?>
    <div class="card text-center" style="margin-top:24px">
      <h3>👀 <?= e(t('visitors.title')) ?></h3>
      <p class="muted"><?= e(t('visitors.premium_hint')) ?></p>
      <a href="/premium" class="btn btn-primary" style="margin-top:12px"><?= e(t('common.premium')) ?></a>
    </div>
  <?php endif; ?>
<?php endif; ?>

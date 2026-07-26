<?php
/** @var array $notifications */
use Amoura\Models\Notification;
(new Notification())->markAllRead((int) ($auth['id'] ?? 0));
$icons = ['match'=>'✨','message'=>'💬','like'=>'❤️','superlike'=>'⭐','comment'=>'💭','post_like'=>'👍','call'=>'📞','payment'=>'💳','system'=>'📢'];
$labels = ['match'=>'Nouveau match','message'=>'vous a envoyé un message','like'=>'vous a liké',
  'superlike'=>'vous a super-liké','comment'=>'a commenté','post_like'=>'a aimé votre publication','call'=>'vous a appelé','payment'=>'Paiement confirmé','system'=>'Annonce'];
?>
<div class="row between" style="margin-bottom:16px">
  <h1><?= e(t('nav.alerts')) ?></h1>
  <button class="btn btn-ghost btn-sm" data-action="enablePush">🔔 Activer les notifications</button>
</div>
<div class="card card-flush">
  <?php if (empty($notifications)): ?>
    <div style="padding:24px" class="muted text-center">Aucune notification.</div>
  <?php endif; ?>
  <?php foreach ($notifications as $n): $data = json_decode($n['data'] ?? '{}', true) ?: []; ?>
    <div class="conv-item" style="<?= $n['read_at'] ? '' : 'background:var(--gradient-brand-soft)' ?>">
      <span style="font-size:1.4rem"><?= $icons[$n['type']] ?? '🔔' ?></span>
      <div class="info">
        <div class="name"><?= e($n['actor_name'] ?? 'Amoura') ?></div>
        <div class="preview">
          <?= e($labels[$n['type']] ?? $n['type']) ?>
          <?= $n['type'] === 'system' && !empty($data['message']) ? ' — ' . e($data['message']) : '' ?>
        </div>
      </div>
      <span class="subtle" style="font-size:.8rem"><?= e(time_ago($n['created_at'])) ?></span>
    </div>
  <?php endforeach; ?>
</div>

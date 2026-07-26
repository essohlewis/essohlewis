<?php /** @var array $calls */ $meId = $auth['id'] ?? 0; ?>
<h1 style="margin-bottom:16px">Historique d'appels</h1>
<div class="card card-flush">
  <?php if (empty($calls)): ?>
    <div style="padding:24px" class="muted text-center">Aucun appel pour le moment.</div>
  <?php endif; ?>
  <?php foreach ($calls as $c): $out = (int) $c['caller_id'] === (int) $meId;
    $name = $out ? $c['callee_name'] : $c['caller_name']; ?>
    <div class="conv-item">
      <span style="font-size:1.4rem"><?= $c['kind'] === 'video' ? '📹' : '📞' ?></span>
      <div class="info">
        <div class="name"><?= e($name) ?></div>
        <div class="preview">
          <?= $out ? '↗ Sortant' : '↙ Entrant' ?> ·
          <?= e($c['status']) ?><?= $c['duration_sec'] ? ' · ' . gmdate('i:s', (int) $c['duration_sec']) : '' ?>
        </div>
      </div>
      <span class="subtle" style="font-size:.8rem"><?= e(time_ago($c['created_at'])) ?></span>
    </div>
  <?php endforeach; ?>
</div>

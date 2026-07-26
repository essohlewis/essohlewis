<?php /** @var array $reports */ /** @var array $photos */ ?>
<h1 style="margin-bottom:20px">Modération</h1>

<h3 style="margin-bottom:12px">Signalements ouverts (<?= count($reports) ?>)</h3>
<table class="data" style="margin-bottom:32px">
  <thead><tr><th>#</th><th>Cible</th><th>Motif</th><th>Détails</th><th>Signalé par</th><th>Actions</th></tr></thead>
  <tbody>
    <?php foreach ($reports as $r): ?>
      <tr>
        <td>#<?= (int) $r['id'] ?></td>
        <td><span class="badge"><?= e($r['target_type']) ?> #<?= (int) $r['target_id'] ?></span></td>
        <td><span class="badge" style="background:rgba(239,68,68,.14);color:var(--danger)"><?= e($r['reason']) ?></span></td>
        <td class="muted"><?= e(mb_substr($r['details'] ?? '', 0, 60)) ?></td>
        <td><?= e($r['reporter_name']) ?></td>
        <td>
          <form method="POST" action="/admin/moderation/reports/<?= (int) $r['id'] ?>" style="display:inline">
            <?= csrf_field() ?><input type="hidden" name="status" value="actioned">
            <button class="btn btn-sm btn-danger">Sanctionner</button></form>
          <form method="POST" action="/admin/moderation/reports/<?= (int) $r['id'] ?>" style="display:inline">
            <?= csrf_field() ?><input type="hidden" name="status" value="dismissed">
            <button class="btn btn-sm btn-ghost">Rejeter</button></form>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($reports)): ?><tr><td colspan="6" class="muted text-center" style="padding:24px">File vide ✅</td></tr><?php endif; ?>
  </tbody>
</table>

<h3 style="margin-bottom:12px">Photos en attente (<?= count($photos) ?>)</h3>
<div class="photo-grid">
  <?php foreach ($photos as $ph): ?>
    <div class="card" style="padding:8px">
      <div class="cell" style="aspect-ratio:1;border-radius:var(--r-sm);overflow:hidden"><img src="<?= e('/uploads/' . ($ph['thumb_path'] ?: $ph['path'])) ?>" alt=""></div>
      <div class="muted" style="font-size:.8rem;margin:6px 0"><?= e($ph['display_name']) ?></div>
      <div class="row">
        <form method="POST" action="/admin/moderation/photos/<?= (int) $ph['id'] ?>" class="grow">
          <?= csrf_field() ?><input type="hidden" name="decision" value="approved"><button class="btn btn-sm btn-primary btn-block">✓</button></form>
        <form method="POST" action="/admin/moderation/photos/<?= (int) $ph['id'] ?>" class="grow">
          <?= csrf_field() ?><input type="hidden" name="decision" value="rejected"><button class="btn btn-sm btn-danger btn-block">✕</button></form>
      </div>
    </div>
  <?php endforeach; ?>
  <?php if (empty($photos)): ?><p class="muted">Aucune photo à modérer.</p><?php endif; ?>
</div>

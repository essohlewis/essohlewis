<?php /** @var array $reports */ /** @var array $photos */ ?>
<h1 style="margin-bottom:20px">Modération</h1>

<h3 style="margin-bottom:12px">Signalements ouverts (<?= count($reports) ?>) — <span class="muted" style="font-size:.9rem">triés par gravité</span></h3>
<form method="POST" action="/admin/moderation/bulk">
  <?= csrf_field() ?>
  <table class="data" style="margin-bottom:12px">
    <thead><tr><th><input type="checkbox" data-check-all></th><th>#</th><th>Gravité</th><th>Cible</th><th>Motif</th><th>Détails</th><th>Par</th><th>Actions</th></tr></thead>
    <tbody>
      <?php $sevColors = [0=>'#b91c1c',1=>'#dc2626',2=>'#ea580c',3=>'#d97706',4=>'#ca8a04',5=>'#6b7280']; foreach ($reports as $r): ?>
        <tr>
          <td><input type="checkbox" name="ids[]" value="<?= (int) $r['id'] ?>" data-check-item></td>
          <td>#<?= (int) $r['id'] ?></td>
          <td><span class="dot" style="background:<?= $sevColors[(int) $r['severity']] ?? '#6b7280' ?>"></span></td>
          <td><span class="badge"><?= e($r['target_type']) ?> #<?= (int) $r['target_id'] ?></span></td>
          <td><span class="badge" style="background:rgba(239,68,68,.14);color:var(--danger)"><?= e($r['reason']) ?></span></td>
          <td class="muted"><?= e(mb_substr($r['details'] ?? '', 0, 50)) ?></td>
          <td><?= e($r['reporter_name']) ?></td>
          <td style="white-space:nowrap">
            <button formaction="/admin/moderation/reports/<?= (int) $r['id'] ?>" name="status" value="actioned" class="btn btn-sm btn-danger">Sanctionner</button>
            <button formaction="/admin/moderation/reports/<?= (int) $r['id'] ?>" name="status" value="dismissed" class="btn btn-sm btn-ghost">Rejeter</button>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (empty($reports)): ?><tr><td colspan="8" class="muted text-center" style="padding:24px">File vide ✅</td></tr><?php endif; ?>
    </tbody>
  </table>
  <?php if (!empty($reports)): ?>
  <div class="row" style="margin-bottom:32px">
    <span class="muted">Sélection :</span>
    <button name="status" value="actioned" class="btn btn-sm btn-danger">Sanctionner la sélection</button>
    <button name="status" value="dismissed" class="btn btn-sm btn-ghost">Rejeter la sélection</button>
  </div>
  <?php endif; ?>
</form>
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
document.querySelector('[data-check-all]')?.addEventListener('change', (e) => {
  document.querySelectorAll('[data-check-item]').forEach(c => c.checked = e.target.checked);
});
</script>

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

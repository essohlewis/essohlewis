<?php /** @var array $logs */ /** @var int $page */ ?>
<h1 style="margin-bottom:20px">Journal d'audit</h1>
<table class="data">
  <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Contexte</th></tr></thead>
  <tbody>
    <?php foreach ($logs as $l): ?>
      <tr>
        <td class="muted" style="white-space:nowrap"><?= date('d/m/Y H:i', strtotime($l['created_at'])) ?></td>
        <td><?= e($l['display_name'] ?? 'Système') ?></td>
        <td><span class="badge"><?= e($l['action']) ?></span></td>
        <td class="muted"><?= e($l['entity_type'] ?? '') ?><?= $l['entity_id'] ? ' #' . (int) $l['entity_id'] : '' ?></td>
        <td class="muted" style="font-size:.8rem;max-width:300px;overflow:hidden;text-overflow:ellipsis"><?= e($l['context'] ?? '') ?></td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($logs)): ?><tr><td colspan="5" class="muted text-center" style="padding:24px">Journal vide.</td></tr><?php endif; ?>
  </tbody>
</table>
<div class="row" style="margin-top:16px;justify-content:center">
  <?php if ($page > 1): ?><a class="btn btn-ghost btn-sm" href="?page=<?= $page-1 ?>">← Précédent</a><?php endif; ?>
  <?php if (count($logs) === 50): ?><a class="btn btn-ghost btn-sm" href="?page=<?= $page+1 ?>">Suivant →</a><?php endif; ?>
</div>

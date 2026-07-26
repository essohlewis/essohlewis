<?php /** @var array $members */ /** @var string $q */ /** @var string $status */ /** @var int $page */ ?>
<h1 style="margin-bottom:20px">Membres</h1>
<form method="GET" action="/admin/members" class="row" style="margin-bottom:16px">
  <input class="input" name="q" value="<?= e($q) ?>" placeholder="Nom, email, téléphone…" style="max-width:280px">
  <select class="select" name="status" style="width:auto">
    <option value="">Tous les statuts</option>
    <?php foreach (['active'=>'Actif','pending'=>'En attente','suspended'=>'Suspendu','banned'=>'Banni'] as $k=>$v): ?>
      <option value="<?= $k ?>" <?= $status===$k?'selected':'' ?>><?= $v ?></option>
    <?php endforeach; ?>
  </select>
  <button class="btn btn-primary">Rechercher</button>
</form>

<table class="data">
  <thead><tr><th>ID</th><th>Membre</th><th>Contact</th><th>Statut</th><th>Vérifié</th><th>Inscrit</th><th></th></tr></thead>
  <tbody>
    <?php foreach ($members as $m): ?>
      <tr>
        <td>#<?= (int) $m['id'] ?></td>
        <td><?= e($m['display_name']) ?></td>
        <td class="muted"><?= e($m['email'] ?? $m['phone'] ?? '—') ?></td>
        <td><span class="badge <?= $m['status']==='active'?'badge-online':'' ?>"><?= e($m['status']) ?></span></td>
        <td><?= $m['is_verified'] ? '✓' : '—' ?></td>
        <td class="muted"><?= date('d/m/Y', strtotime($m['created_at'])) ?></td>
        <td><a href="/admin/members/<?= (int) $m['id'] ?>" class="btn btn-sm btn-ghost">Gérer</a></td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($members)): ?><tr><td colspan="7" class="muted text-center" style="padding:24px">Aucun résultat.</td></tr><?php endif; ?>
  </tbody>
</table>

<div class="row" style="margin-top:16px;justify-content:center">
  <?php if ($page > 1): ?><a class="btn btn-ghost btn-sm" href="?q=<?= e($q) ?>&status=<?= e($status) ?>&page=<?= $page-1 ?>">← Précédent</a><?php endif; ?>
  <?php if (count($members) === 25): ?><a class="btn btn-ghost btn-sm" href="?q=<?= e($q) ?>&status=<?= e($status) ?>&page=<?= $page+1 ?>">Suivant →</a><?php endif; ?>
</div>

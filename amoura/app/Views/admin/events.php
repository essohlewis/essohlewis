<?php /** @var array $events */
$typeLabels = ['speed_dating' => 'Speed-dating', 'salon' => 'Salon', 'meetup' => 'Rencontre', 'online' => 'En ligne'];
$statusBadge = ['draft' => '', 'published' => 'badge-online', 'canceled' => 'alert-error'];
?>
<h1 style="margin-bottom:16px">Événements</h1>

<div class="card" style="margin-bottom:24px">
  <h3 style="margin:0 0 12px">Créer un événement</h3>
  <form method="POST" action="/admin/events" class="stack">
    <?= csrf_field() ?>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <div class="field grow"><label>Titre</label><input class="input" name="title" required maxlength="150"></div>
      <div class="field"><label>Type</label>
        <select class="select" name="type">
          <?php foreach ($typeLabels as $k => $v): ?><option value="<?= $k ?>"><?= e($v) ?></option><?php endforeach; ?>
        </select></div>
    </div>
    <div class="field"><label>Description</label><textarea class="input" name="description" rows="3" maxlength="5000"></textarea></div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <div class="field"><label>Début</label><input class="input" type="datetime-local" name="starts_at" required></div>
      <div class="field"><label>Fin (option.)</label><input class="input" type="datetime-local" name="ends_at"></div>
      <div class="field"><label>Capacité (vide = illimité)</label><input class="input" type="number" name="capacity" min="1"></div>
    </div>
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:end">
      <div class="field grow"><label>Lieu (si présentiel)</label><input class="input" name="location" maxlength="200"></div>
      <label class="checkbox"><input type="checkbox" name="is_online" value="1"> En ligne (vidéo)</label>
    </div>
    <button class="btn btn-primary" style="align-self:flex-start">Créer (brouillon)</button>
  </form>
</div>

<table class="data" style="width:100%">
  <thead><tr><th>Événement</th><th>Type</th><th>Date</th><th>Inscrits</th><th>Statut</th><th>Actions</th></tr></thead>
  <tbody>
    <?php foreach ($events as $ev): ?>
      <tr>
        <td><a href="/events/<?= e($ev['slug']) ?>"><?= e($ev['title']) ?></a></td>
        <td><?= e($typeLabels[$ev['type']] ?? $ev['type']) ?></td>
        <td><?= e(date('d/m/Y H:i', strtotime((string) $ev['starts_at']))) ?></td>
        <td><?= (int) ($ev['going_count'] ?? 0) ?><?= $ev['capacity'] !== null ? '/' . (int) $ev['capacity'] : '' ?></td>
        <td><span class="badge <?= $statusBadge[$ev['status']] ?? '' ?>"><?= e($ev['status']) ?></span></td>
        <td>
          <div class="row" style="gap:6px">
            <?php foreach (['published' => 'Publier', 'canceled' => 'Annuler', 'draft' => 'Brouillon'] as $st => $label):
              if ($ev['status'] === $st) continue; ?>
              <form method="POST" action="/admin/events/<?= (int) $ev['id'] ?>/status">
                <?= csrf_field() ?><input type="hidden" name="status" value="<?= $st ?>">
                <button class="btn btn-sm btn-ghost"><?= $label ?></button>
              </form>
            <?php endforeach; ?>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($events)): ?><tr><td colspan="6" class="muted">Aucun événement.</td></tr><?php endif; ?>
  </tbody>
</table>

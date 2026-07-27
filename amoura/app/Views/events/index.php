<?php
/**
 * Liste des événements à venir.
 * @var array $upcoming  @var array $mine
 */
$typeLabels = ['speed_dating' => '⚡ Speed-dating', 'salon' => '🎭 Salon', 'meetup' => '🥂 Rencontre', 'online' => '💻 En ligne'];
$card = function (array $e) use ($typeLabels) {
    $full = $e['capacity'] !== null && (int) ($e['going_count'] ?? 0) >= (int) $e['capacity'];
    ?>
    <a href="/events/<?= e($e['slug']) ?>" class="card" style="display:block;text-decoration:none">
      <div class="row between" style="align-items:center">
        <span class="badge"><?= $typeLabels[$e['type']] ?? e($e['type']) ?></span>
        <?php if (!empty($e['is_online'])): ?><span class="badge badge-online">En ligne</span><?php endif; ?>
      </div>
      <h3 style="margin:8px 0 4px"><?= e($e['title']) ?></h3>
      <div class="muted" style="font-size:.85rem">
        📅 <?= e(date('d/m/Y à H:i', strtotime((string) $e['starts_at']))) ?>
        <?php if (!empty($e['location'])): ?> · 📍 <?= e($e['location']) ?><?php endif; ?>
      </div>
      <?php if ($e['capacity'] !== null): ?>
        <div class="muted" style="font-size:.8rem;margin-top:6px">
          <?= (int) ($e['going_count'] ?? 0) ?>/<?= (int) $e['capacity'] ?> inscrits
          <?php if ($full): ?><span style="color:#b91c1c">· complet (liste d'attente)</span><?php endif; ?>
        </div>
      <?php endif; ?>
    </a>
    <?php
};
?>
<div style="max-width:820px;margin:0 auto">
  <h1 style="margin-bottom:8px">Événements & communautés</h1>
  <p class="muted" style="margin-bottom:20px">Rencontrez du monde en vrai ou en vidéo : speed-dating, salons, sorties.</p>

  <?php if (!empty($mine)): ?>
    <h3 style="margin:0 0 10px">Mes inscriptions</h3>
    <div class="stat-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-bottom:28px">
      <?php foreach ($mine as $e): ?>
        <div>
          <?php $card($e); ?>
          <div class="muted" style="font-size:.78rem;margin-top:4px;text-align:center">
            <?= ($e['attendee_status'] ?? '') === 'going' ? '✅ Inscription confirmée' : '⏳ Liste d\'attente' ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <h3 style="margin:0 0 10px">À venir</h3>
  <?php if (empty($upcoming)): ?>
    <div class="card"><p class="muted" style="margin:0">Aucun événement programmé pour le moment. Revenez bientôt !</p></div>
  <?php else: ?>
    <div class="stat-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
      <?php foreach ($upcoming as $e) { $card($e); } ?>
    </div>
  <?php endif; ?>
</div>

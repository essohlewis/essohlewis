<?php
/**
 * Détail d'un événement.
 * @var array $event  @var ?string $my_status
 */
$typeLabels = ['speed_dating' => '⚡ Speed-dating', 'salon' => '🎭 Salon', 'meetup' => '🥂 Rencontre', 'online' => '💻 En ligne'];
$going = (int) ($event['going_count'] ?? 0);
$capacity = $event['capacity'] !== null ? (int) $event['capacity'] : null;
$full = $capacity !== null && $going >= $capacity;
?>
<div style="max-width:640px;margin:0 auto">
  <p><a href="/events" class="gradient-text">← Tous les événements</a></p>

  <div class="card stack">
    <div class="row between" style="align-items:center">
      <span class="badge"><?= $typeLabels[$event['type']] ?? e($event['type']) ?></span>
      <?php if (!empty($event['is_online'])): ?><span class="badge badge-online">En ligne</span><?php endif; ?>
    </div>
    <h1 style="margin:0"><?= e($event['title']) ?></h1>
    <div class="muted">
      📅 <?= e(date('l d F Y à H:i', strtotime((string) $event['starts_at']))) ?>
      <?php if (!empty($event['ends_at'])): ?> → <?= e(date('H:i', strtotime((string) $event['ends_at']))) ?><?php endif; ?>
      <?php if (!empty($event['location'])): ?><br>📍 <?= e($event['location']) ?><?php endif; ?>
    </div>

    <?php if (!empty($event['description'])): ?>
      <p style="white-space:pre-line;margin:4px 0"><?= e($event['description']) ?></p>
    <?php endif; ?>

    <?php if ($capacity !== null): ?>
      <div class="muted" style="font-size:.9rem">
        <?= $going ?>/<?= $capacity ?> inscrits<?php if ($full): ?> — <b>complet</b><?php endif; ?>
      </div>
    <?php endif; ?>

    <?php if ($my_status === 'going'): ?>
      <div class="alert alert-success" style="margin:0">✅ Votre inscription est confirmée.</div>
      <form method="POST" action="/events/<?= (int) $event['id'] ?>/leave" data-confirm="Se désinscrire ?">
        <?= csrf_field() ?><button class="btn btn-ghost">Se désinscrire</button>
      </form>
    <?php elseif ($my_status === 'waitlist'): ?>
      <div class="alert" style="margin:0">⏳ Vous êtes sur la liste d'attente.</div>
      <form method="POST" action="/events/<?= (int) $event['id'] ?>/leave">
        <?= csrf_field() ?><button class="btn btn-ghost">Quitter la liste d'attente</button>
      </form>
    <?php else: ?>
      <form method="POST" action="/events/<?= (int) $event['id'] ?>/join">
        <?= csrf_field() ?>
        <button class="btn btn-primary btn-lg"><?= $full ? 'Rejoindre la liste d\'attente' : 'Je participe 🎉' ?></button>
      </form>
    <?php endif; ?>
  </div>
</div>

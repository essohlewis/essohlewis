<?php
/**
 * Page publique et partageable d'un événement (acquisition / SEO).
 * @var array $event
 */
$typeLabels = ['speed_dating' => '⚡ Speed-dating', 'salon' => '🎭 Salon', 'meetup' => '🥂 Rencontre', 'online' => '💻 En ligne'];
$isAuth = \Amoura\Core\Security\Auth::check();
?>
<div class="container" style="max-width:680px;margin:0 auto;padding:32px 16px">
  <div class="card stack">
    <div class="row" style="gap:8px">
      <span class="badge"><?= $typeLabels[$event['type']] ?? e($event['type']) ?></span>
      <?php if (!empty($event['is_online'])): ?><span class="badge badge-online">En ligne</span><?php endif; ?>
    </div>
    <h1 style="margin:0"><?= e($event['title']) ?></h1>
    <div class="muted">
      📅 <?= e(date('l d F Y à H:i', strtotime((string) $event['starts_at']))) ?>
      <?php if (!empty($event['location'])): ?><br>📍 <?= e($event['location']) ?><?php endif; ?>
    </div>

    <?php if (!empty($event['description'])): ?>
      <p style="white-space:pre-line"><?= e($event['description']) ?></p>
    <?php endif; ?>

    <div class="stack" style="gap:10px;border-top:1px solid var(--border,#efecf4);padding-top:16px">
      <?php if ($isAuth): ?>
        <a class="btn btn-primary btn-lg" href="/events/<?= e($event['slug']) ?>">Voir et m'inscrire</a>
      <?php else: ?>
        <p class="muted" style="margin:0">Rejoignez Amoura pour participer à cet événement et rencontrer du monde.</p>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <a class="btn btn-primary btn-lg" href="/register">Créer mon compte gratuit</a>
          <a class="btn btn-ghost btn-lg" href="/login">J'ai déjà un compte</a>
        </div>
      <?php endif; ?>
    </div>
  </div>

  <p class="muted text-center" style="margin-top:16px"><a href="/" class="gradient-text">← Découvrir Amoura</a></p>
</div>

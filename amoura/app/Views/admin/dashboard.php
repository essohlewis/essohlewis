<?php
/** @var array $users */ /** @var array $revenue */ /** @var array $signups_series */
$maxSignup = max(1, ...array_map(fn($s) => $s['count'], $signups_series));
$money = fn($cents) => number_format($cents / 100, 0, ',', ' ');
?>
<h1 style="margin-bottom:20px">Tableau de bord</h1>

<div class="stat-grid" style="margin-bottom:24px">
  <?php foreach ([
    ['Membres', number_format($users['total']), 'total'],
    ['Actifs', number_format($users['active']), 'success'],
    ['En ligne', number_format($users['online']), 'success'],
    ["Aujourd'hui", '+' . $users['today'], 'brand'],
    ['Matchs', number_format($matches_total)],
    ['Messages', number_format($messages_total)],
    ['Appels', number_format($calls_total)],
    ['Abonnés', number_format($active_subs)],
  ] as $card): ?>
    <div class="stat-card"><div class="value"><?= $card[1] ?></div><div class="label"><?= e($card[0]) ?></div></div>
  <?php endforeach; ?>
</div>

<div class="stat-grid" style="grid-template-columns:2fr 1fr;margin-bottom:24px">
  <div class="stat-card">
    <div class="row between"><h3>Inscriptions (14 jours)</h3></div>
    <div class="mini-chart" style="margin-top:16px">
      <?php foreach ($signups_series as $s): ?>
        <div class="cbar" style="height:<?= max(6, (int) ($s['count'] / $maxSignup * 100)) ?>%" title="<?= $s['date'] ?> : <?= $s['count'] ?>"></div>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="stat-card">
    <h3>Revenus</h3>
    <div class="value" style="font-size:1.8rem;margin-top:8px"><?= $money($revenue['total_cents']) ?> <span class="muted" style="font-size:1rem">XOF</span></div>
    <p class="muted">Ce mois : <?= $money($revenue['month_cents']) ?> · <?= (int) $revenue['paid_count'] ?> paiements</p>
    <?php if ($open_reports > 0): ?>
      <a href="/admin/moderation" class="badge" style="background:rgba(239,68,68,.14);color:var(--danger);margin-top:12px"><?= (int) $open_reports ?> signalement(s) à traiter</a>
    <?php endif; ?>
  </div>
</div>

<div class="stat-card">
  <h3 style="margin-bottom:12px">Notification de masse</h3>
  <form method="POST" action="/admin/broadcast" class="row">
    <?= csrf_field() ?>
    <input class="input grow" name="message" placeholder="Message à tous les membres actifs…" required maxlength="500">
    <button class="btn btn-primary">Envoyer</button>
  </form>
</div>

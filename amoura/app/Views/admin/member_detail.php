<?php /** @var array|null $member */ /** @var array|null $raw */ /** @var array $photos */
if (!$member) { echo '<p>Membre introuvable.</p>'; return; }
$id = (int) $raw['id']; ?>
<a href="/admin/members" class="nav-link">← Membres</a>
<div class="row" style="align-items:flex-start;gap:24px;margin-top:16px;flex-wrap:wrap">
  <div class="card" style="flex:1;min-width:280px">
    <div class="row">
      <img class="avatar avatar-lg" src="<?= e(avatar_url($member['avatar_path'] ?? null)) ?>" alt="">
      <div>
        <h2><?= e($member['display_name']) ?> <?= $member['is_verified'] ? '<span class="badge badge-verified">✓</span>' : '' ?></h2>
        <p class="muted"><?= e($raw['email'] ?? $raw['phone'] ?? '') ?></p>
        <span class="badge"><?= e($raw['status']) ?></span>
      </div>
    </div>
    <dl style="margin-top:16px;line-height:1.9">
      <div>Âge : <?= age_from($member['birthdate'] ?? null) ?? '—' ?></div>
      <div>Genre : <?= e($member['gender'] ?? '—') ?></div>
      <div>Ville : <?= e(trim(($member['city'] ?? '') . ' ' . ($member['country'] ?? ''))) ?></div>
      <div>Inscrit : <?= date('d/m/Y', strtotime($raw['created_at'])) ?></div>
      <div>Dernière activité : <?= e(time_ago($raw['last_active_at'] ?? null)) ?></div>
    </dl>
    <?php if ($photos): ?>
      <div class="photo-grid" style="margin-top:16px">
        <?php foreach ($photos as $ph): ?><div class="cell"><img src="<?= e('/uploads/' . ($ph['thumb_path'] ?: $ph['path'])) ?>" alt=""></div><?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>

  <div class="card" style="width:320px">
    <h3 style="margin-bottom:12px">Actions</h3>
    <form method="POST" action="/admin/members/<?= $id ?>/status" class="stack">
      <?= csrf_field() ?>
      <div class="field"><label>Statut</label>
        <select class="select" name="status">
          <?php foreach (['active'=>'Actif','suspended'=>'Suspendre','banned'=>'Bannir','deleted'=>'Supprimer'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= $raw['status']===$k?'selected':'' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select></div>
      <div class="field"><label>Durée suspension (jours)</label><input class="input" type="number" name="days" value="7" min="1"></div>
      <div class="field"><label>Motif</label><input class="input" name="reason" value="<?= e($raw['ban_reason'] ?? '') ?>"></div>
      <button class="btn btn-primary btn-block">Appliquer</button>
    </form>
    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">
    <form method="POST" action="/admin/members/<?= $id ?>/verify" class="row">
      <?= csrf_field() ?>
      <input type="hidden" name="verified" value="<?= $member['is_verified'] ? 0 : 1 ?>">
      <button class="btn btn-ghost btn-block"><?= $member['is_verified'] ? 'Retirer la vérification' : '✓ Vérifier le profil' ?></button>
    </form>
  </div>
</div>

<?php
/** @var array $profile */
/** @var array $photos */
/** @var bool $own */
$age = age_from($profile['birthdate'] ?? null);
$interests = json_decode($profile['interests'] ?? '[]', true) ?: [];
$languages = json_decode($profile['languages'] ?? '[]', true) ?: [];
$primary = $photos[0]['path'] ?? ($profile['avatar_path'] ?? null);
?>
<div class="card card-flush" style="max-width:640px;margin:0 auto">
  <div class="profile-cover">
    <?php if ($primary): ?><img src="<?= e(avatar_url($primary)) ?>" alt=""><?php endif; ?>
  </div>
  <div style="padding:0 24px 24px">
    <div class="profile-head" style="padding:0">
      <img class="avatar" src="<?= e(avatar_url($profile['avatar_path'] ?? $primary)) ?>" alt="">
      <div class="grow" style="padding-bottom:8px">
        <h1 style="display:flex;align-items:center;gap:8px">
          <?= e($profile['display_name']) ?><?= $age ? ', ' . $age : '' ?>
          <?php if (!empty($profile['is_verified'])): ?><span class="badge badge-verified">✓ Vérifié</span><?php endif; ?>
          <?php if (!empty($profile['is_online'])): ?><span class="dot online" title="En ligne"></span><?php endif; ?>
        </h1>
        <p class="muted"><?= e(trim(($profile['city'] ?? '') . ' ' . ($profile['country'] ?? ''))) ?></p>
      </div>
    </div>

    <?php if ($own): ?>
      <div class="row" style="margin:16px 0">
        <a href="/profile/edit" class="btn btn-primary grow">Modifier mon profil</a>
        <a href="/premium" class="btn btn-ghost">⭐ Premium</a>
      </div>
    <?php else: ?>
      <div class="row" style="margin:16px 0">
        <a href="/messages" class="btn btn-primary grow">💬 Message</a>
        <button class="btn btn-ghost" data-call-start="audio" data-peer="<?= (int) $profile['id'] ?>">📞</button>
        <button class="btn btn-ghost" data-call-start="video" data-peer="<?= (int) $profile['id'] ?>">📹</button>
        <button class="btn btn-ghost" data-action="reportUser" data-arg="<?= (int) $profile['id'] ?>" title="Signaler">⚑</button>
      </div>
    <?php endif; ?>

    <?php if (!empty($profile['bio'])): ?>
      <div class="stack"><h3>À propos</h3><p style="white-space:pre-wrap"><?= e($profile['bio']) ?></p></div>
    <?php endif; ?>

    <?php if ($interests): ?>
      <div style="margin-top:20px"><h3 style="margin-bottom:8px">Centres d'intérêt</h3>
        <div class="row wrap"><?php foreach ($interests as $i): ?><span class="chip"><?= e($i) ?></span><?php endforeach; ?></div></div>
    <?php endif; ?>

    <?php if ($languages || !empty($profile['job_title'])): ?>
      <div style="margin-top:20px" class="muted">
        <?php if (!empty($profile['job_title'])): ?>💼 <?= e($profile['job_title']) ?><br><?php endif; ?>
        <?php if ($languages): ?>🗣️ <?= e(implode(', ', $languages)) ?><?php endif; ?>
      </div>
    <?php endif; ?>

    <?php if (count($photos) > 1): ?>
      <div style="margin-top:24px"><h3 style="margin-bottom:12px">Photos</h3>
        <div class="photo-grid">
          <?php foreach ($photos as $ph): ?>
            <div class="cell"><img src="<?= e('/uploads/' . ($ph['thumb_path'] ?: $ph['path'])) ?>"
                 data-lightbox data-full="<?= e('/uploads/' . $ph['path']) ?>" alt="" loading="lazy"></div>
          <?php endforeach; ?>
        </div></div>
    <?php endif; ?>
  </div>
</div>
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
function reportUser(id){
  const reason = prompt("Motif du signalement (fake, harassment, nudity, scam, underage, spam, other) :", "fake");
  if(!reason) return;
  Api.post('/report', {target_type:'user', target_id:id, reason}).then(r=>Amoura.toast(r.message||'Merci.')).catch(e=>Amoura.toast(e.message));
}
</script>

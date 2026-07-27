<?php /** @var array $plans */ ?>
<section style="padding:64px 0;background:var(--gradient-brand-soft)">
  <div class="container" style="text-align:center;max-width:760px">
    <span class="chip">💞 Plus de 2M de célibataires</span>
    <h1 style="font-size:clamp(2.2rem,6vw,3.6rem);margin:16px 0"><?= e(t('home.hero_title')) ?></h1>
    <p class="muted" style="font-size:1.2rem;max-width:560px;margin:0 auto"><?= e(t('home.hero_sub')) ?></p>
    <div class="row" style="justify-content:center;margin-top:28px">
      <a href="/register" class="btn btn-primary btn-lg"><?= e(t('home.cta_primary')) ?></a>
      <a href="/login" class="btn btn-ghost btn-lg"><?= e(t('home.cta_secondary')) ?></a>
    </div>
    <p class="subtle" style="margin-top:12px;font-size:.85rem"><?= e(t('home.age_notice')) ?></p>
  </div>
</section>

<section class="container" style="padding:56px 0">
  <div class="stat-grid" style="max-width:960px;margin:0 auto">
    <?php foreach ([
        ['🔥', 'Découverte intelligente', 'Des profils recommandés selon vos affinités et votre localisation.'],
        ['💬', 'Chat & appels', 'Messages, vocaux, appels audio et vidéo chiffrés de bout en bout via WebRTC.'],
        ['🛡️', 'Sécurité & modération', 'Profils vérifiés, signalement, protection anti-arnaque et conformité RGPD.'],
    ] as $f): ?>
      <div class="card"><div style="font-size:2rem"><?= $f[0] ?></div>
        <h3 style="margin:8px 0"><?= e($f[1]) ?></h3><p class="muted"><?= e($f[2]) ?></p></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="container" style="padding:24px 0 64px" id="pricing">
  <h2 style="text-align:center;margin-bottom:8px">Des offres pour tous</h2>
  <p class="muted text-center" style="margin-bottom:32px">Commencez gratuitement, passez Premium quand vous voulez.</p>
  <div class="stat-grid" style="max-width:920px;margin:0 auto">
    <?php foreach ($plans as $plan): $features = json_decode($plan['features'] ?? '{}', true) ?: []; ?>
      <div class="card" style="<?= $plan['slug'] === 'premium' ? 'border:2px solid var(--brand-500)' : '' ?>">
        <?php if ($plan['slug'] === 'premium'): ?><span class="badge badge-premium">Populaire</span><?php endif; ?>
        <h3 style="margin:8px 0"><?= e($plan['name']) ?></h3>
        <div style="font-size:2rem;font-weight:800">
          <?= $plan['price_cents'] > 0 ? e(money((int) $plan['price_cents'], (string) $plan['currency'])) : 'Gratuit' ?>
          <?php if ($plan['price_cents'] > 0): ?><span class="muted" style="font-size:1rem">/mois</span><?php endif; ?>
        </div>
        <p class="muted"><?= e($plan['description']) ?></p>
        <a href="/register" class="btn <?= $plan['slug'] === 'premium' ? 'btn-primary' : 'btn-ghost' ?> btn-block" style="margin-top:16px">Choisir</a>
      </div>
    <?php endforeach; ?>
  </div>
</section>

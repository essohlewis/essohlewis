<?php
/**
 * Inviter des amis (parrainage).
 * @var string $code  @var string $link  @var array $stats
 * @var int $referrer_reward  @var int $referee_bonus
 */
?>
<div style="max-width:560px;margin:0 auto">
  <h1 style="margin-bottom:8px">Inviter des amis</h1>
  <p class="muted" style="margin-bottom:20px">Partagez votre lien : à chaque ami qui rejoint Amoura et
    vérifie son compte, vous gagnez <strong><?= (int) $referrer_reward ?> Super Likes</strong>
    et votre ami·e en reçoit <strong><?= (int) $referee_bonus ?></strong>. 🎁</p>

  <!-- Statistiques -->
  <div class="stat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    <?php foreach ([
        ['Invités', $stats['invited']], ['Validés', $stats['rewarded']],
        ['Super Likes gagnés', $stats['credits_earned']],
    ] as [$label, $value]): ?>
      <div class="card" style="padding:14px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800"><?= (int) $value ?></div>
        <div class="muted" style="font-size:.78rem"><?= e($label) ?></div>
      </div>
    <?php endforeach; ?>
  </div>

  <!-- Lien de parrainage -->
  <div class="card stack">
    <h3 style="margin:0">Votre lien de parrainage</h3>
    <div class="field">
      <div class="row" style="gap:8px">
        <input class="input" id="refLink" value="<?= e($link) ?>" readonly style="flex:1">
        <button class="btn btn-primary" type="button" data-copy="#refLink">Copier</button>
      </div>
    </div>
    <p class="muted" style="margin:0">Votre code : <strong style="letter-spacing:2px"><?= e($code) ?></strong></p>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <a class="btn btn-ghost" target="_blank" rel="noopener"
         href="https://wa.me/?text=<?= rawurlencode('Rejoins-moi sur Amoura ! ' . $link) ?>">Partager sur WhatsApp</a>
      <a class="btn btn-ghost"
         href="mailto:?subject=<?= rawurlencode('Rejoins-moi sur Amoura') ?>&body=<?= rawurlencode('Inscris-toi avec mon lien : ' . $link) ?>">Par e-mail</a>
    </div>
  </div>

  <p class="muted" style="margin-top:16px"><a href="/discover" class="gradient-text">← Retour à la découverte</a></p>
</div>

<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
  document.querySelector('[data-copy]')?.addEventListener('click', (e) => {
    const el = document.querySelector(e.currentTarget.getAttribute('data-copy'));
    if (!el) return;
    el.select();
    navigator.clipboard?.writeText(el.value).then(() => {
      e.currentTarget.textContent = 'Copié ✓';
      setTimeout(() => { e.currentTarget.textContent = 'Copier'; }, 1500);
    });
  });
</script>

<?php
/** @var array $plans */ /** @var array|null $current */ /** @var array $gateways */
$gatewayLabels = ['stripe'=>'💳 Carte (Stripe)','paypal'=>'🅿️ PayPal','cinetpay'=>'📱 Mobile Money (CinetPay)','paydunya'=>'📱 Mobile Money (PayDunya)'];
?>
<div style="max-width:900px;margin:0 auto">
  <h1 class="text-center">Passez à la vitesse supérieure</h1>
  <p class="muted text-center" style="margin-bottom:8px">Plus de likes, filtres avancés, boost et badge premium.</p>

  <?php $devises = \Amoura\Services\Money\CurrencyContext::available(); if (count($devises) > 1): ?>
    <div class="text-center" style="margin-bottom:8px">
      <label class="muted" style="font-size:.85rem">Afficher les prix en&nbsp;</label>
      <select class="select" data-currency-select style="width:auto;display:inline-block">
        <?php foreach ($devises as $d): ?>
          <option value="<?= e($d['code']) ?>" <?= currency() === $d['code'] ? 'selected' : '' ?>>
            <?= e($d['code']) ?> — <?= e($d['name']) ?></option>
        <?php endforeach; ?>
      </select>
      <?php if (currency() !== \Amoura\Models\Currency::BASE): ?>
        <span class="muted" style="font-size:.8rem;display:block;margin-top:4px">Montants indicatifs ; le paiement est effectué en FCFA (XOF).</span>
      <?php endif; ?>
    </div>
  <?php endif; ?>
  <?php if ($current): ?>
    <div class="alert alert-success">Abonnement actif : <b><?= e($current['plan_name']) ?></b>
      <?= $current['current_period_end'] ? ' jusqu\'au ' . date('d/m/Y', strtotime($current['current_period_end'])) : '' ?>.
      <form method="POST" action="/premium/cancel" style="display:inline" data-confirm="Annuler ?">
        <?= csrf_field() ?><button class="btn btn-sm btn-ghost">Annuler</button></form>
    </div>
  <?php endif; ?>

  <div class="stat-grid" style="margin-top:24px">
    <?php foreach ($plans as $plan): $f = json_decode($plan['features'] ?? '{}', true) ?: []; ?>
      <div class="card" style="<?= $plan['slug']==='vip' ? 'border:2px solid var(--accent-500)' : ($plan['slug']==='premium'?'border:2px solid var(--brand-500)':'') ?>">
        <h3><?= e($plan['name']) ?></h3>
        <div style="font-size:1.8rem;font-weight:800;margin:8px 0">
          <?= $plan['price_cents']>0 ? e(money((int) $plan['price_cents'], (string) $plan['currency'])) : 'Gratuit' ?>
          <?php if ($plan['price_cents']>0): ?><span class="muted" style="font-size:.9rem">/mois</span><?php endif; ?>
        </div>
        <ul style="list-style:none;font-size:.9rem;line-height:2">
          <li><?= !empty($f['unlimited_likes']) ? '✅' : ('🔸 '.($f['daily_likes']??20)) ?> Likes <?= !empty($f['unlimited_likes'])?'illimités':'/jour' ?></li>
          <li><?= !empty($f['see_who_liked'])?'✅':'❌' ?> Voir qui vous a liké</li>
          <li><?= !empty($f['advanced_filters'])?'✅':'❌' ?> Filtres avancés</li>
          <li><?= !empty($f['boost'])?'✅ '.$f['boost'].' boost':'❌ Boost' ?></li>
          <li><?= !empty($f['badge'])?'✅':'❌' ?> Badge premium</li>
          <?php if (!empty($f['incognito'])): ?><li>✅ Mode incognito</li><?php endif; ?>
        </ul>
        <?php if ($plan['price_cents']>0 && (!$current || $current['plan_slug']!==$plan['slug'])): ?>
          <button class="btn btn-primary btn-block" data-action="openCheckout" data-arg="<?= e($plan['slug']) ?>" style="margin-top:12px">Choisir</button>
        <?php elseif ($plan['price_cents']==0): ?>
          <button class="btn btn-ghost btn-block" disabled style="margin-top:12px">Offre de base</button>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </div>
  <p style="text-align:center;margin-top:24px">
    <a class="link" href="/premium/history">📄 Voir mon historique de facturation & mes reçus</a>
  </p>
</div>

<dialog id="checkoutDialog" class="card" style="border:none;border-radius:var(--r-lg);max-width:420px;width:90%">
  <h3 style="margin-bottom:12px">Finaliser l'abonnement</h3>
  <form method="POST" action="/premium/subscribe" class="stack">
    <?= csrf_field() ?>
    <input type="hidden" name="plan" id="checkoutPlan">
    <div class="field"><label>Moyen de paiement</label>
      <select class="select" name="gateway" id="gatewaySelect" data-action-change="togglePhone">
        <?php foreach ($gateways as $g): ?><option value="<?= e($g) ?>"><?= $gatewayLabels[$g] ?? e($g) ?></option><?php endforeach; ?>
      </select></div>
    <div class="field" id="phoneField" style="display:none"><label>Numéro Mobile Money</label>
      <input class="input" name="phone" placeholder="07 xx xx xx xx">
      <div class="hint">07 → Orange · 05 → MTN · 01 → Moov</div></div>
    <div class="field"><label>Code promo (facultatif)</label>
      <input class="input" name="coupon" placeholder="AMOURA10" style="text-transform:uppercase"></div>
    <div class="row between">
      <button type="button" class="btn btn-ghost" data-modal-close="checkoutDialog">Annuler</button>
      <button class="btn btn-primary">Payer</button>
    </div>
  </form>
</dialog>
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
function openCheckout(slug){ document.getElementById('checkoutPlan').value=slug; togglePhone();
  document.getElementById('checkoutDialog').showModal(); }
function togglePhone(){ const g=document.getElementById('gatewaySelect').value;
  document.getElementById('phoneField').style.display=(g==='cinetpay'||g==='paydunya')?'block':'none'; }
document.querySelector('[data-currency-select]')?.addEventListener('change', function(){
  window.location.href = '/currency/' + encodeURIComponent(this.value);
});
</script>

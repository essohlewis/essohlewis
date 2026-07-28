<?php
/** @var array $products */ /** @var array $credits */ /** @var array $gateways */
$gatewayLabels = ['stripe'=>'💳 Carte (Stripe)','paypal'=>'🅿️ PayPal','cinetpay'=>'📱 Mobile Money (CinetPay)','paydunya'=>'📱 Mobile Money (PayDunya)','flutterwave'=>'🌍 Carte & Mobile Money (Flutterwave)','wave'=>'🌊 Wave','mpesa'=>'📲 M-Pesa'];
$icons = ['boost'=>'🚀','superlike'=>'⭐','reveal'=>'👀'];
?>
<div style="max-width:900px;margin:0 auto">
  <h1 class="text-center">Boutique</h1>
  <p class="muted text-center" style="margin-bottom:20px">Boostez votre visibilité et vos chances de match.</p>

  <!-- Portefeuille -->
  <div class="card" style="margin-bottom:24px">
    <div class="row wrap" style="justify-content:space-around;text-align:center">
      <div><div style="font-size:1.6rem">🚀</div><b><?= (int) $credits['boost'] ?></b><div class="muted" style="font-size:.8rem">Boosts</div>
        <?php if ($credits['boost'] > 0): ?><form method="POST" action="/store/boost" style="margin-top:6px"><?= csrf_field() ?><button class="btn btn-sm btn-primary">Utiliser</button></form><?php endif; ?></div>
      <div><div style="font-size:1.6rem">⭐</div><b><?= (int) $credits['superlike'] ?></b><div class="muted" style="font-size:.8rem">Super Likes</div></div>
      <div><div style="font-size:1.6rem">👀</div><b><?= (int) $credits['reveal'] ?></b><div class="muted" style="font-size:.8rem">Reveal</div>
        <?php if ($credits['reveal'] > 0): ?><form method="POST" action="/store/reveal" style="margin-top:6px"><?= csrf_field() ?><button class="btn btn-sm btn-primary">Utiliser</button></form><?php endif; ?></div>
    </div>
  </div>

  <!-- Catalogue -->
  <div class="stat-grid">
    <?php foreach ($products as $p): ?>
      <div class="card text-center">
        <div style="font-size:2rem"><?= $icons[$p['item']] ?? '🎁' ?></div>
        <h3 style="margin:6px 0"><?= e($p['name']) ?></h3>
        <p class="muted" style="font-size:.85rem;min-height:34px"><?= e($p['description']) ?></p>
        <div style="font-size:1.4rem;font-weight:800;margin:8px 0">
          <?= e(money((int) $p['price_cents'], (string) $p['currency'])) ?>
        </div>
        <button class="btn btn-primary btn-block" data-action="openBuy" data-arg="<?= e($p['slug']) ?>">Acheter</button>
      </div>
    <?php endforeach; ?>
  </div>
  <p class="muted text-center" style="margin-top:20px"><a href="/premium" class="gradient-text">Voir aussi les abonnements Premium →</a></p>
</div>

<dialog id="buyDialog" class="card" style="border:none;border-radius:var(--r-lg);max-width:420px;width:90%">
  <h3 style="margin-bottom:12px">Finaliser l'achat</h3>
  <form method="POST" action="/store/buy" class="stack">
    <?= csrf_field() ?>
    <input type="hidden" name="product" id="buyProduct">
    <div class="field"><label>Moyen de paiement</label>
      <select class="select" name="gateway" id="buyGateway" data-action-change="toggleBuyPhone">
        <?php foreach ($gateways as $g): ?><option value="<?= e($g) ?>"><?= $gatewayLabels[$g] ?? e($g) ?></option><?php endforeach; ?>
      </select></div>
    <div class="field" id="buyPhoneField" style="display:none"><label>Numéro Mobile Money</label>
      <input class="input" name="phone" placeholder="07 xx xx xx xx">
      <div class="hint">07 → Orange · 05 → MTN · 01 → Moov</div></div>
    <div class="row between">
      <button type="button" class="btn btn-ghost" data-modal-close="buyDialog">Annuler</button>
      <button class="btn btn-primary">Payer</button>
    </div>
  </form>
</dialog>
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
function openBuy(slug){ document.getElementById('buyProduct').value = slug; toggleBuyPhone();
  document.getElementById('buyDialog').showModal(); }
function toggleBuyPhone(){ const g=document.getElementById('buyGateway').value;
  document.getElementById('buyPhoneField').style.display=(g==='cinetpay'||g==='paydunya'||g==='mpesa')?'block':'none'; }
</script>

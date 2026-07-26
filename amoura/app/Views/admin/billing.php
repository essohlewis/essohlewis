<?php /** @var array $plans */ /** @var array $transactions */ /** @var array $revenue */
$money = fn($c) => number_format($c / 100, 0, ',', ' '); ?>
<h1 style="margin-bottom:20px">Abonnements & paiements</h1>

<div class="stat-grid" style="margin-bottom:24px">
  <div class="stat-card"><div class="value"><?= $money($revenue['total_cents']) ?></div><div class="label">Revenu total (XOF)</div></div>
  <div class="stat-card"><div class="value"><?= $money($revenue['month_cents']) ?></div><div class="label">Ce mois (XOF)</div></div>
  <div class="stat-card"><div class="value"><?= (int) $revenue['paid_count'] ?></div><div class="label">Paiements réussis</div></div>
</div>

<h3 style="margin-bottom:12px">Plans</h3>
<div class="stat-grid" style="margin-bottom:32px">
  <?php foreach ($plans as $plan): ?>
    <form method="POST" action="/admin/billing/plans/<?= (int) $plan['id'] ?>" class="card stack">
      <?= csrf_field() ?>
      <div class="field"><label>Nom (<?= e($plan['slug']) ?>)</label><input class="input" name="name" value="<?= e($plan['name']) ?>"></div>
      <div class="field"><label>Description</label><input class="input" name="description" value="<?= e($plan['description']) ?>"></div>
      <div class="row">
        <div class="field grow"><label>Prix</label><input class="input" type="number" step="0.01" name="price" value="<?= number_format($plan['price_cents']/100,2,'.','') ?>"></div>
        <div class="field" style="width:90px"><label>Devise</label><input class="input" name="currency" value="<?= e($plan['currency']) ?>" maxlength="3"></div>
      </div>
      <label class="checkbox"><input type="checkbox" name="is_active" value="1" <?= $plan['is_active']?'checked':'' ?>> Actif</label>
      <button class="btn btn-primary">Enregistrer</button>
    </form>
  <?php endforeach; ?>
</div>

<h3 style="margin-bottom:12px">Transactions récentes</h3>
<table class="data">
  <thead><tr><th>#</th><th>Membre</th><th>Montant</th><th>Passerelle</th><th>Méthode</th><th>Statut</th><th>Date</th><th></th></tr></thead>
  <tbody>
    <?php foreach ($transactions as $t): ?>
      <tr>
        <td>#<?= (int) $t['id'] ?></td>
        <td><?= e($t['display_name']) ?></td>
        <td><?= $money($t['amount_cents']) ?> <?= e($t['currency']) ?></td>
        <td><?= e($t['gateway']) ?></td>
        <td class="muted"><?= e($t['payment_method'] ?? '—') ?></td>
        <td><span class="badge <?= $t['status']==='paid'?'badge-online':'' ?>"><?= e($t['status']) ?></span></td>
        <td class="muted"><?= date('d/m/Y H:i', strtotime($t['created_at'])) ?></td>
        <td><?php if ($t['status']==='paid'): ?>
          <form method="POST" action="/admin/billing/transactions/<?= (int) $t['id'] ?>/refund" onsubmit="return confirm('Rembourser ?')">
            <?= csrf_field() ?><button class="btn btn-sm btn-ghost">Rembourser</button></form>
        <?php endif; ?></td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table>

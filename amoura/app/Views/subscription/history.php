<?php
/**
 * Historique de facturation de l'utilisateur.
 * @var array $transactions
 */
$statusLabels = [
    'paid' => ['Payé', 'alert-success'], 'pending' => ['En attente', ''],
    'initiated' => ['Initié', ''], 'failed' => ['Échoué', 'alert-error'],
    'refunded' => ['Remboursé', ''],
];
?>
<div class="container" style="max-width:820px;margin:0 auto;padding:24px 16px">
  <h1 style="margin:0 0 4px">Historique de facturation</h1>
  <p class="muted" style="margin:0 0 24px">Vos abonnements et achats. Téléchargez un reçu pour chaque paiement confirmé.</p>

  <?php if (empty($transactions)): ?>
    <div class="card" style="padding:32px;text-align:center">
      <p class="muted">Aucune transaction pour le moment.</p>
      <a class="btn btn-primary" href="/premium">Découvrir Premium</a>
    </div>
  <?php else: ?>
    <div class="card" style="padding:0;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="text-align:left;color:var(--muted,#6b6577);font-size:.85rem">
            <th style="padding:14px 16px">Date</th>
            <th style="padding:14px 16px">Article</th>
            <th style="padding:14px 16px">Montant</th>
            <th style="padding:14px 16px">Statut</th>
            <th style="padding:14px 16px"></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($transactions as $t):
              $item = $t['plan_name'] ?? $t['product_name'] ?? 'Paiement';
              [$label, $cls] = $statusLabels[$t['status']] ?? [$t['status'], ''];
              $amount = number_format((int) $t['amount_cents'] / 100, 2, ',', ' ');
          ?>
          <tr style="border-top:1px solid var(--border,#efecf4);font-size:.92rem">
            <td style="padding:14px 16px"><?= e(date('d/m/Y', strtotime((string) $t['created_at']))) ?></td>
            <td style="padding:14px 16px"><?= e($item) ?></td>
            <td style="padding:14px 16px"><?= e($amount) ?> <?= e($t['currency']) ?></td>
            <td style="padding:14px 16px">
              <span class="badge <?= e($cls) ?>" style="font-size:.78rem"><?= e($label) ?></span>
            </td>
            <td style="padding:14px 16px;text-align:right">
              <?php if ($t['status'] === 'paid'): ?>
                <a href="/premium/receipt/<?= (int) $t['id'] ?>" class="link">Reçu →</a>
              <?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

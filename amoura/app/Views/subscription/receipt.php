<?php
/**
 * Reçu imprimable d'une transaction payée.
 * @var array $tx      transaction (avec plan_name / product_name)
 * @var array $user    utilisateur courant
 * @var string $appName
 */
$item = $tx['plan_name'] ?? $tx['product_name'] ?? 'Paiement';
$amount = number_format((int) $tx['amount_cents'] / 100, 2, ',', ' ');
$methods = [
    'card' => 'Carte bancaire', 'orange_money' => 'Orange Money',
    'mtn_money' => 'MTN Money', 'moov_money' => 'Moov Money', 'paypal' => 'PayPal',
];
$method = $methods[$tx['payment_method'] ?? ''] ?? ($tx['payment_method'] ?? ucfirst((string) $tx['gateway']));
$paidAt = !empty($tx['paid_at']) ? date('d/m/Y à H:i', strtotime((string) $tx['paid_at'])) : '—';
?>
<div class="receipt">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div>
      <h1>💞 <span class="brand-txt"><?= e($appName) ?></span></h1>
      <p class="muted" style="margin:4px 0 0">Reçu de paiement</p>
    </div>
    <div style="text-align:right">
      <span class="badge">✔ Payé</span>
      <p class="muted" style="margin:8px 0 0">Reçu n° <?= e(str_pad((string) $tx['id'], 6, '0', STR_PAD_LEFT)) ?></p>
    </div>
  </div>

  <table>
    <tr><th>Client</th><td><?= e($user['display_name'] ?? '') ?></td></tr>
    <tr><th>Article</th><td><?= e($item) ?></td></tr>
    <tr><th>Date de paiement</th><td><?= e($paidAt) ?></td></tr>
    <tr><th>Moyen de paiement</th><td><?= e($method) ?></td></tr>
    <tr><th>Référence prestataire</th><td><?= e($tx['gateway_ref'] ?? '—') ?></td></tr>
    <tr>
      <th>Montant réglé</th>
      <td class="total"><?= e($amount) ?> <?= e($tx['currency']) ?></td>
    </tr>
  </table>

  <p class="muted">Merci pour votre confiance. Ce reçu confirme un paiement traité avec succès.
     Pour toute question, contactez le support depuis vos paramètres de compte.</p>
</div>

<div class="actions">
  <a class="btn btn-back" href="/premium/history">← Historique</a>
  <button class="btn btn-print" data-print type="button">🖨️ Imprimer / PDF</button>
</div>

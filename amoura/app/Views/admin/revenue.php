<?php
/**
 * Tableau de bord revenus.
 * @var array $summary  @var array $trend  @var array $by_gateway  @var array $by_plan
 */
$money = static fn(int $cents): string => number_format($cents / 100, 0, ',', ' ');
$cur = 'XOF';
$maxTrend = max(1, ...array_map(static fn($m) => (int) $m['cents'], $trend ?: [['cents' => 0]]));
?>
<h1 style="margin-bottom:4px">Revenus</h1>
<p class="muted" style="margin-bottom:20px">Indicateurs consolidés — montants en <?= $cur ?>.</p>

<!-- KPIs -->
<div class="stat-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:24px">
  <?php
  $kpis = [
    ['MRR', $money((int) $summary['mrr_cents']) . ' ' . $cur, 'Revenu mensuel récurrent'],
    ['ARPU', $money((int) $summary['arpu_cents']) . ' ' . $cur, 'Revenu moyen / abonné'],
    ['LTV', $money((int) $summary['ltv_cents']) . ' ' . $cur, 'Valeur vie client (est.)'],
    ['Churn', number_format($summary['churn_rate'] * 100, 1) . ' %', 'Taux d\'attrition (30 j)'],
    ['Abonnés actifs', number_format((int) $summary['active_subscribers'], 0, ',', ' '), 'Abonnements en cours'],
    ['Ce mois', $money((int) $summary['month_cents']) . ' ' . $cur, 'Revenu du mois'],
    ['Total encaissé', $money((int) $summary['total_cents']) . ' ' . $cur, 'Depuis le lancement'],
    ['Clients payants', number_format((int) $summary['payers'], 0, ',', ' '), 'Ont déjà payé'],
  ];
  foreach ($kpis as [$label, $value, $hint]): ?>
    <div class="card" style="padding:16px">
      <div class="muted" style="font-size:.8rem"><?= e($label) ?></div>
      <div style="font-size:1.5rem;font-weight:800;margin:2px 0"><?= e($value) ?></div>
      <div class="muted" style="font-size:.72rem"><?= e($hint) ?></div>
    </div>
  <?php endforeach; ?>
</div>

<!-- Tendance mensuelle (SVG, sans script) -->
<div class="card" style="margin-bottom:24px">
  <h3 style="margin:0 0 12px">Revenu par mois (12 derniers mois)</h3>
  <?php $n = count($trend); $bw = 100 / max(1, $n); ?>
  <svg viewBox="0 0 100 46" preserveAspectRatio="none" style="width:100%;height:180px;overflow:visible">
    <?php foreach (array_values($trend) as $i => $m):
      $h = $maxTrend > 0 ? ($m['cents'] / $maxTrend) * 38 : 0;
      $x = $i * $bw; ?>
      <rect x="<?= number_format($x + $bw * 0.15, 3, '.', '') ?>" y="<?= number_format(40 - $h, 3, '.', '') ?>"
            width="<?= number_format($bw * 0.7, 3, '.', '') ?>" height="<?= number_format($h, 3, '.', '') ?>"
            fill="url(#g)" rx="0.4"></rect>
      <text x="<?= number_format($x + $bw / 2, 3, '.', '') ?>" y="45" font-size="1.7"
            text-anchor="middle" fill="#8a8397"><?= e(substr($m['month'], 5)) ?></text>
    <?php endforeach; ?>
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff5a7e"></stop><stop offset="1" stop-color="#8b5cf6"></stop>
    </linearGradient></defs>
  </svg>
  <div class="muted" style="font-size:.75rem;text-align:right">Max : <?= $money($maxTrend) ?> <?= $cur ?></div>
</div>

<!-- Répartitions -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
  <div class="card">
    <h3 style="margin:0 0 12px">Par prestataire</h3>
    <table class="data" style="width:100%">
      <thead><tr><th>Prestataire</th><th>Transactions</th><th>Revenu</th></tr></thead>
      <tbody>
        <?php foreach ($by_gateway as $g): ?>
          <tr><td><?= e(ucfirst((string) $g['gateway'])) ?></td><td><?= (int) $g['n'] ?></td>
              <td><?= $money((int) $g['cents']) ?> <?= $cur ?></td></tr>
        <?php endforeach; ?>
        <?php if (empty($by_gateway)): ?><tr><td colspan="3" class="muted">Aucun encaissement.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h3 style="margin:0 0 12px">Par offre</h3>
    <table class="data" style="width:100%">
      <thead><tr><th>Offre</th><th>Ventes</th><th>Revenu</th></tr></thead>
      <tbody>
        <?php foreach ($by_plan as $p): ?>
          <tr><td><?= e((string) $p['plan']) ?></td><td><?= (int) $p['n'] ?></td>
              <td><?= $money((int) $p['cents']) ?> <?= $cur ?></td></tr>
        <?php endforeach; ?>
        <?php if (empty($by_plan)): ?><tr><td colspan="3" class="muted">Aucune vente d'abonnement.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
</div>

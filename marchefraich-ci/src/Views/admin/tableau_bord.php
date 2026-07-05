<?php /** @var array $stats @var array $config */ ?>
<h1>⚙️ Administration</h1>
<p class="sous-titre">Vue d'ensemble de la plateforme.</p>

<div class="grille grille-2">
  <div class="carte centre">
    <div class="muted">Commandes totales</div>
    <div style="font-size:2rem;font-weight:800"><?= (int) ($stats['total_commandes'] ?? 0) ?></div>
  </div>
  <div class="carte centre">
    <div class="muted">Commandes livrées</div>
    <div style="font-size:2rem;font-weight:800;color:var(--vert)"><?= (int) ($stats['livrees'] ?? 0) ?></div>
  </div>
  <div class="carte centre">
    <div class="muted">Volume livré</div>
    <div style="font-size:1.4rem;font-weight:800"><?= xof((int) ($stats['volume'] ?? 0)) ?></div>
  </div>
  <div class="carte centre">
    <div class="muted">Commissions perçues</div>
    <div style="font-size:1.4rem;font-weight:800;color:var(--orange)"><?= xof((int) ($stats['commissions'] ?? 0)) ?></div>
  </div>
</div>

<div class="carte mt">
  <h2 style="margin-top:0">Paramètres du modèle économique</h2>
  <div class="ligne"><span>Taux de commission</span><strong><?= e((string) $config['business']['taux_commission']) ?> %</strong></div>
  <div class="ligne"><span>Frais de livraison</span><strong><?= xof((int) $config['business']['frais_livraison']) ?></strong></div>
  <div class="ligne"><span>Paiement CinetPay</span><strong><?= $config['cinetpay']['mode'] === 'production' ? 'Production' : 'Simulation' ?></strong></div>
  <p class="champ-aide">Ces valeurs se règlent via les variables d'environnement (voir README).</p>
</div>

<div class="grille grille-2 mt">
  <a class="bouton secondaire" href="<?= lien('/admin/marches') ?>">🏪 Gérer les marchés</a>
  <a class="bouton secondaire" href="<?= lien('/admin/vendeuses') ?>">👩🏾‍🌾 Valider les vendeuses</a>
</div>

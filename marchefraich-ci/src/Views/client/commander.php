<?php /** @var array $client @var array $lignes @var array $vendeuse @var array $totaux */ use App\Core\Session; ?>
<h1>Valider ma commande</h1>

<div class="carte recap">
  <?php foreach ($lignes as $l): ?>
    <div class="ligne">
      <span><?= (int) $l['quantite'] ?> × <?= e($l['produit']['nom']) ?></span>
      <span><?= xof($l['sous_total']) ?></span>
    </div>
  <?php endforeach; ?>
  <div class="ligne"><span>Livraison</span><span><?= xof($totaux['livraison']) ?></span></div>
  <div class="ligne total"><span>Total</span><span><?= xof($totaux['total']) ?></span></div>
</div>

<form method="post" action="<?= lien('/client/commander') ?>" class="carte">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">

  <label for="adresse">Adresse de livraison</label>
  <input type="text" id="adresse" name="adresse" value="<?= e($client['adresse'] ?? '') ?>" placeholder="Rue, villa, repère..." required>

  <label for="quartier">Quartier</label>
  <input type="text" id="quartier" name="quartier" value="<?= e($client['quartier'] ?? '') ?>">

  <label for="notes">Note pour la vendeuse (facultatif)</label>
  <textarea id="notes" name="notes" placeholder="Ex : bien mûr, appelez à l'arrivée..."></textarea>

  <label>Mode de paiement</label>
  <label style="font-weight:400"><input type="radio" name="mode_paiement" value="mobile_money" checked style="width:auto"> Mobile Money</label>

  <div id="operateurs" style="padding-left:1rem">
    <label style="font-weight:400"><input type="radio" name="operateur" value="orange_money" checked style="width:auto"> Orange Money</label>
    <label style="font-weight:400"><input type="radio" name="operateur" value="mtn_money" style="width:auto"> MTN Money</label>
    <label style="font-weight:400"><input type="radio" name="operateur" value="wave" style="width:auto"> Wave</label>
  </div>

  <label style="font-weight:400"><input type="radio" name="mode_paiement" value="especes" style="width:auto"> Espèces à la livraison</label>

  <button type="submit" class="bouton pleine-largeur mt">Confirmer et payer <?= xof($totaux['total']) ?></button>
</form>

<p class="centre muted"><a href="<?= lien('/client/panier') ?>">← Modifier mon panier</a></p>

<script>
  // Affiche/masque le choix d'opérateur selon le mode de paiement.
  document.querySelectorAll('input[name="mode_paiement"]').forEach(function (r) {
    r.addEventListener('change', function () {
      document.getElementById('operateurs').style.display =
        document.querySelector('input[name="mode_paiement"]:checked').value === 'mobile_money' ? 'block' : 'none';
    });
  });
</script>

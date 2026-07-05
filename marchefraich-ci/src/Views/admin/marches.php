<?php /** @var array $marches */ use App\Core\Session; ?>
<h1>🏪 Marchés</h1>

<details class="carte">
  <summary style="font-weight:700;cursor:pointer">➕ Ajouter un marché</summary>
  <form method="post" action="<?= lien('/admin/marches') ?>" class="mt">
    <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
    <input type="hidden" name="action" value="creer">
    <label for="nom">Nom du marché</label>
    <input type="text" id="nom" name="nom" required>
    <div class="ligne-champs">
      <div><label for="quartier">Quartier</label><input type="text" id="quartier" name="quartier"></div>
      <div><label for="ville">Ville</label><input type="text" id="ville" name="ville" value="Abidjan"></div>
    </div>
    <label for="adresse">Adresse / repère</label>
    <input type="text" id="adresse" name="adresse">
    <button class="bouton pleine-largeur mt" type="submit">Créer</button>
  </form>
</details>

<?php foreach ($marches as $m): ?>
  <div class="carte">
    <div class="ligne" style="border:none;padding:0">
      <div>
        <strong><?= e($m['nom']) ?></strong>
        <?php if ((int) $m['actif'] === 1): ?><span class="badge livree">Actif</span><?php else: ?><span class="badge annulee">Inactif</span><?php endif; ?>
        <div class="muted"><?= e($m['quartier']) ?>, <?= e($m['ville']) ?></div>
      </div>
      <form method="post" action="<?= lien('/admin/marches') ?>">
        <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
        <input type="hidden" name="action" value="basculer">
        <input type="hidden" name="marche_id" value="<?= (int) $m['id'] ?>">
        <button class="bouton secondaire petit" type="submit"><?= (int) $m['actif'] === 1 ? 'Désactiver' : 'Activer' ?></button>
      </form>
    </div>
  </div>
<?php endforeach; ?>

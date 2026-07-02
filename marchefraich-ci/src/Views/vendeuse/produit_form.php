<?php /** @var ?array $produit @var string $action @var string $titre */ use App\Core\Session;
$p = $produit ?? [];
?>
<h1><?= e($titre) ?></h1>
<form method="post" action="<?= e($action) ?>" class="carte" enctype="multipart/form-data">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">

  <label for="nom">Nom du produit</label>
  <input type="text" id="nom" name="nom" value="<?= e($p['nom'] ?? '') ?>" required autofocus>

  <label for="categorie">Catégorie</label>
  <input type="text" id="categorie" name="categorie" list="cats" value="<?= e($p['categorie'] ?? '') ?>" placeholder="Légumes, Fruits, Tubercules...">
  <datalist id="cats">
    <option value="Légumes"><option value="Fruits"><option value="Tubercules">
    <option value="Condiments"><option value="Céréales"><option value="Viandes"><option value="Poissons">
  </datalist>

  <div class="ligne-champs">
    <div>
      <label for="prix_xof">Prix (FCFA)</label>
      <input type="number" id="prix_xof" name="prix_xof" min="1" inputmode="numeric" value="<?= e((string) ($p['prix_xof'] ?? '')) ?>" required>
    </div>
    <div>
      <label for="unite">Unité</label>
      <input type="text" id="unite" name="unite" value="<?= e($p['unite'] ?? 'tas') ?>" placeholder="tas, kg, sac...">
    </div>
  </div>

  <label for="quantite_disponible">Quantité disponible</label>
  <input type="number" id="quantite_disponible" name="quantite_disponible" min="0" inputmode="numeric" value="<?= e((string) ($p['quantite_disponible'] ?? '0')) ?>" required>

  <label for="description">Description (facultatif)</label>
  <textarea id="description" name="description"><?= e($p['description'] ?? '') ?></textarea>

  <label for="photo">Photo du produit</label>
  <input type="file" id="photo" name="photo" accept="image/*">
  <?php if (!empty($p['photo'])): ?>
    <p class="champ-aide">Photo actuelle conservée si vous n'en choisissez pas une nouvelle.</p>
  <?php endif; ?>

  <?php if (!empty($p)): ?>
    <label style="font-weight:400;margin-top:1rem">
      <input type="checkbox" name="actif" value="1" style="width:auto" <?= (int) ($p['actif'] ?? 1) === 1 ? 'checked' : '' ?>>
      Produit visible par les clients
    </label>
  <?php endif; ?>

  <button type="submit" class="bouton pleine-largeur mt">Enregistrer</button>
</form>
<p class="centre"><a href="<?= lien('/vendeuse/produits') ?>">← Retour aux produits</a></p>

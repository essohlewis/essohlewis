<?php /** @var string $action @var array $marches */ use App\Core\Session; ?>
<h1>Devenir vendeuse</h1>
<p class="sous-titre">Inscription simple : renseignez vos informations et ajoutez vos produits ensuite.</p>

<form method="post" action="<?= e($action) ?>" class="carte" enctype="multipart/form-data">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
  <label for="nom">Nom / Nom de la boutique</label>
  <input type="text" id="nom" name="nom" placeholder="Tante Adjoua" required autofocus>

  <label for="telephone">Numéro de téléphone</label>
  <input type="tel" id="telephone" name="telephone" inputmode="tel" required>

  <label for="mot_de_passe">Mot de passe</label>
  <input type="password" id="mot_de_passe" name="mot_de_passe" required>

  <label for="marche_id">Mon marché</label>
  <select id="marche_id" name="marche_id" required>
    <?php foreach ($marches as $m): ?>
      <option value="<?= (int) $m['id'] ?>"><?= e($m['nom']) ?> — <?= e($m['quartier']) ?></option>
    <?php endforeach; ?>
  </select>

  <label for="description">Description (ce que vous vendez)</label>
  <input type="text" id="description" name="description" placeholder="Légumes frais et condiments">

  <label for="photo_etal">Photo de votre étal (facultatif)</label>
  <input type="file" id="photo_etal" name="photo_etal" accept="image/*">

  <button type="submit" class="bouton pleine-largeur mt">Créer ma boutique</button>
</form>
<p class="centre">Déjà inscrite ? <a href="<?= lien('/vendeuse/connexion') ?>">Se connecter</a></p>

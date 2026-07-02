<?php /** @var string $action */ use App\Core\Session; ?>
<h1>Créer mon compte client</h1>
<form method="post" action="<?= e($action) ?>" class="carte">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
  <label for="nom">Nom complet</label>
  <input type="text" id="nom" name="nom" required autofocus>

  <label for="telephone">Numéro de téléphone</label>
  <input type="tel" id="telephone" name="telephone" inputmode="tel" placeholder="07 00 00 00 01" required>

  <label for="mot_de_passe">Mot de passe</label>
  <input type="password" id="mot_de_passe" name="mot_de_passe" required>
  <p class="champ-aide">Au moins 4 caractères.</p>

  <div class="ligne-champs">
    <div>
      <label for="quartier">Quartier</label>
      <input type="text" id="quartier" name="quartier" placeholder="Angré">
    </div>
    <div>
      <label for="adresse">Adresse de livraison</label>
      <input type="text" id="adresse" name="adresse" placeholder="Rue, villa...">
    </div>
  </div>

  <button type="submit" class="bouton pleine-largeur mt">Créer mon compte</button>
</form>
<p class="centre">Déjà inscrit ? <a href="<?= lien('/connexion') ?>">Se connecter</a></p>

<?php /** @var string $action */ use App\Core\Session; ?>
<h1>Devenir coursier</h1>
<form method="post" action="<?= e($action) ?>" class="carte">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
  <label for="nom">Nom complet</label>
  <input type="text" id="nom" name="nom" required autofocus>

  <label for="telephone">Numéro de téléphone</label>
  <input type="tel" id="telephone" name="telephone" inputmode="tel" required>

  <label for="mot_de_passe">Mot de passe</label>
  <input type="password" id="mot_de_passe" name="mot_de_passe" required>

  <label for="zone">Zone de livraison habituelle</label>
  <input type="text" id="zone" name="zone" placeholder="Angré, Cocody...">

  <button type="submit" class="bouton pleine-largeur mt">Créer mon compte</button>
</form>
<p class="centre">Déjà inscrit ? <a href="<?= lien('/coursier/connexion') ?>">Se connecter</a></p>

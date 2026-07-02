<?php /** @var string $action */ use App\Core\Session; ?>
<h1>⚙️ Espace administrateur</h1>
<form method="post" action="<?= e($action) ?>" class="carte">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
  <label for="email">Email</label>
  <input type="email" id="email" name="email" placeholder="admin@marchefraich.ci" required autofocus>
  <label for="mot_de_passe">Mot de passe</label>
  <input type="password" id="mot_de_passe" name="mot_de_passe" required>
  <button type="submit" class="bouton pleine-largeur mt">Se connecter</button>
</form>
<p class="centre muted"><a href="<?= lien('/') ?>">← Retour à l'accueil</a></p>

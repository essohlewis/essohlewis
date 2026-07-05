<?php
/** @var string $role @var string $action @var string $lienInscription @var string $titre */
use App\Core\Session;
$libelles = ['client' => 'Client', 'vendeuse' => 'Vendeuse', 'coursier' => 'Coursier'];
?>
<h1><?= e($titre) ?></h1>
<p class="sous-titre">Connectez-vous avec votre numéro de téléphone.</p>

<form method="post" action="<?= e($action) ?>" class="carte">
  <input type="hidden" name="csrf" value="<?= e(Session::jetonCsrf()) ?>">
  <label for="telephone">Numéro de téléphone</label>
  <input type="tel" id="telephone" name="telephone" inputmode="tel" placeholder="07 00 00 00 01" required autofocus>

  <label for="mot_de_passe">Mot de passe</label>
  <input type="password" id="mot_de_passe" name="mot_de_passe" required>

  <button type="submit" class="bouton pleine-largeur mt">Se connecter</button>
</form>

<p class="centre">Pas encore de compte ? <a href="<?= e($lienInscription) ?>">Créer un compte <?= e(strtolower($libelles[$role] ?? '')) ?></a></p>
<p class="centre muted"><a href="<?= lien('/') ?>">← Retour à l'accueil</a></p>

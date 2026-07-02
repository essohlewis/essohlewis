<?php
/** @var string $contenu  Contenu de la vue (déjà rendu) */
/** @var string $titre    Titre de page */
/** @var array  $config   Configuration */

use App\Core\Session;
use App\Core\Panier;

$base = rtrim($config['app']['base_url'], '/');
$nomApp = $config['app']['nom'];

// Détection du rôle connecté pour la barre de navigation basse.
$estClient   = Session::estConnecte('client');
$estVendeuse = Session::estConnecte('vendeuse');
$estCoursier = Session::estConnecte('coursier');
$estAdmin    = Session::estConnecte('admin');

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$actif = fn(string $p): string => str_contains($uri, $p) ? 'actif' : '';
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#2e7d32">
  <meta name="description" content="Marché de quartier digitalisé : commandez vos vivriers frais, payez Mobile Money, livraison locale.">
  <title><?= e($titre ?? 'Accueil') ?> — <?= e($nomApp) ?></title>
  <link rel="manifest" href="<?= e($base) ?>/manifest.webmanifest">
  <link rel="apple-touch-icon" href="<?= e($base) ?>/icons/icon-192.png">
  <link rel="stylesheet" href="<?= e($base) ?>/css/app.css">
</head>
<body>
  <header class="entete">
    <a href="<?= e($base) ?>/" class="logo">Marché<span>Fraîch</span> CI</a>
    <?php if ($estClient): ?>
      <a href="<?= e($base) ?>/client/panier" class="panier-lien">🛒 <?= Panier::nombreArticles() ?></a>
    <?php elseif ($estVendeuse): ?>
      <a href="<?= e($base) ?>/vendeuse/deconnexion" class="panier-lien">Déconnexion</a>
    <?php elseif ($estCoursier): ?>
      <a href="<?= e($base) ?>/coursier/deconnexion" class="panier-lien">Déconnexion</a>
    <?php elseif ($estAdmin): ?>
      <a href="<?= e($base) ?>/admin/deconnexion" class="panier-lien">Déconnexion</a>
    <?php endif; ?>
  </header>

  <main class="conteneur">
    <?php foreach (Session::recupererFlashs() as $flash): ?>
      <div class="flash <?= e($flash['type']) ?>"><?= e($flash['message']) ?></div>
    <?php endforeach; ?>

    <?= $contenu ?>
  </main>

  <?php if ($estClient): ?>
    <nav class="nav-bas">
      <a href="<?= e($base) ?>/client" class="<?= $actif('/client') && !str_contains($uri,'commande') && !str_contains($uri,'panier') ? 'actif' : '' ?>"><span class="icone">🏠</span>Accueil</a>
      <a href="<?= e($base) ?>/client/panier" class="<?= $actif('/panier') ?>"><span class="icone">🛒</span>Panier</a>
      <a href="<?= e($base) ?>/client/commandes" class="<?= $actif('/commande') ?>"><span class="icone">📦</span>Commandes</a>
      <a href="<?= e($base) ?>/deconnexion"><span class="icone">🚪</span>Quitter</a>
    </nav>
  <?php elseif ($estVendeuse): ?>
    <nav class="nav-bas">
      <a href="<?= e($base) ?>/vendeuse" class="<?= $actif('/vendeuse') && !str_contains($uri,'produit') && !str_contains($uri,'commande') ? 'actif' : '' ?>"><span class="icone">📊</span>Tableau</a>
      <a href="<?= e($base) ?>/vendeuse/produits" class="<?= $actif('/produit') ?>"><span class="icone">🥬</span>Produits</a>
      <a href="<?= e($base) ?>/vendeuse/deconnexion"><span class="icone">🚪</span>Quitter</a>
    </nav>
  <?php elseif ($estAdmin): ?>
    <nav class="nav-bas">
      <a href="<?= e($base) ?>/admin" class="<?= $uri === $base.'/admin' ? 'actif' : '' ?>"><span class="icone">📊</span>Tableau</a>
      <a href="<?= e($base) ?>/admin/marches" class="<?= $actif('/marches') ?>"><span class="icone">🏪</span>Marchés</a>
      <a href="<?= e($base) ?>/admin/vendeuses" class="<?= $actif('/vendeuses') ?>"><span class="icone">👩🏾‍🌾</span>Vendeuses</a>
      <a href="<?= e($base) ?>/admin/coursiers" class="<?= $actif('/coursiers') ?>"><span class="icone">🛵</span>Coursiers</a>
    </nav>
  <?php endif; ?>

  <script src="<?= e($base) ?>/js/app.js"></script>
</body>
</html>

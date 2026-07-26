<?php /** @var int $code */ /** @var string $message */ ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= (int) $code ?> · Amoura</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <div style="min-height:100vh;display:grid;place-items:center;padding:24px">
    <div class="text-center">
      <div class="gradient-text" style="font-size:5rem;font-weight:800"><?= (int) $code ?></div>
      <h2><?= e($message ?? 'Une erreur est survenue') ?></h2>
      <a href="/" class="btn btn-primary" style="margin-top:20px">Retour à l'accueil</a>
    </div>
  </div>
</body>
</html>

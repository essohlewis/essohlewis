<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head><?php include __DIR__ . '/../partials/head.php'; ?></head>
<body data-auth="0">
  <div style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr">
    <div class="hide-mobile" style="background:var(--gradient-brand);position:relative;overflow:hidden;display:grid;place-items:center;padding:48px">
      <div style="color:#fff;max-width:420px">
        <a href="/" class="brand" style="color:#fff;margin-bottom:24px"><img class="logo" src="/assets/img/logo.svg" alt="">Amoura</a>
        <h1 style="color:#fff;font-size:2.6rem;line-height:1.15">Rencontrez la bonne personne.</h1>
        <p style="opacity:.9;margin-top:16px;font-size:1.1rem">Discutez, appelez en vidéo, partagez vos moments. Des milliers de célibataires vous attendent.</p>
      </div>
    </div>
    <div style="display:grid;place-items:center;padding:32px">
      <div style="width:100%;max-width:420px">
        <?php foreach (['success' => 'alert-success', 'error' => 'alert-error'] as $k => $cls): ?>
          <?php if (!empty($flash[$k])): ?><div class="alert <?= $cls ?>"><?= e($flash[$k]) ?></div><?php endif; ?>
        <?php endforeach; ?>
        <?= $content ?>
      </div>
    </div>
  </div>
  <script src="/assets/js/api.js"></script>
  <script src="/assets/js/app.js"></script>
  <script src="/assets/js/ui.js"></script>
</body>
</html>

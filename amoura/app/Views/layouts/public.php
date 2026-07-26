<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head><?php include __DIR__ . '/../partials/head.php'; ?></head>
<body data-auth="0">
  <header class="app-header">
    <div class="container row between" style="width:100%">
      <a href="/" class="brand"><img class="logo" src="/assets/img/logo.svg" alt=""><span class="gradient-text">Amoura</span></a>
      <nav class="row">
        <a href="/p/about" class="nav-link hide-mobile"><?= e(t('nav.about')) ?></a>
        <a href="/login" class="nav-link"><?= e(t('nav.login')) ?></a>
        <a href="/register" class="btn btn-primary btn-sm"><?= e(t('nav.register')) ?></a>
        <a href="/lang/<?= locale() === 'fr' ? 'en' : 'fr' ?>" class="btn btn-icon btn-ghost" title="<?= e(t('common.language')) ?>"><?= locale() === 'fr' ? 'EN' : 'FR' ?></a>
        <button class="btn btn-icon btn-ghost" data-theme-toggle title="<?= e(t('common.theme')) ?>">◐</button>
      </nav>
    </div>
  </header>
  <main><?= $content ?></main>
  <footer style="border-top:1px solid var(--border);padding:32px 0;margin-top:48px">
    <div class="container row between wrap">
      <span class="muted">© <?= date('Y') ?> Amoura. Rencontres responsables (18+).</span>
      <nav class="row wrap">
        <a href="/p/terms" class="nav-link">CGU</a>
        <a href="/p/privacy" class="nav-link">Confidentialité</a>
        <a href="/p/faq" class="nav-link">FAQ</a>
      </nav>
    </div>
  </footer>
  <script src="/assets/js/api.js"></script>
  <script src="/assets/js/app.js"></script>
  <script src="/assets/js/ui.js"></script>
</body>
</html>

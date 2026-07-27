<?php
/** @var string $content */
/** @var array|null $auth */
use Amoura\Core\Security\Auth;
$path = $_SERVER['REQUEST_URI'] ?? '/admin';
$item = function (string $href, string $label, string $icon, ?string $perm = null) use ($path) {
    if ($perm !== null && !Auth::can($perm)) return '';
    $active = str_starts_with($path, $href) && ($href !== '/admin' || $path === '/admin' || $path === '/admin/') ? ' active' : '';
    return '<a href="' . $href . '" class="nav-link' . $active . '">' . $icon . ' ' . $label . '</a>';
};
?>
<!doctype html>
<html lang="fr">
<head><?php include __DIR__ . '/../partials/head.php'; ?></head>
<body data-auth="1">
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a href="/admin" class="brand" style="margin-bottom:24px"><img class="logo" src="/assets/img/logo.svg" alt="">Admin</a>
      <nav>
        <?= $item('/admin', 'Tableau de bord', '📊', 'dashboard.view') ?>
        <?= $item('/admin/members', 'Membres', '👥', 'members.view') ?>
        <?= $item('/admin/moderation', 'Modération', '🛡️', 'moderation.review') ?>
        <?= $item('/admin/verification', 'Vérifications', '✅', 'members.verify') ?>
        <?= $item('/admin/revenue', 'Revenus', '📈', 'subscriptions.manage') ?>
        <?= $item('/admin/billing', 'Abonnements', '💳', 'subscriptions.manage') ?>
        <?= $item('/admin/settings', 'Paramètres', '⚙️', 'settings.view') ?>
        <?= $item('/admin/pages', 'Pages CMS', '📄', 'cms.manage') ?>
        <?= $item('/admin/roles', 'Rôles', '🔑', 'roles.manage') ?>
        <?= $item('/admin/audit', 'Journal', '📜', 'dashboard.view') ?>
      </nav>
      <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
      <a href="/app" class="nav-link">← Retour au site</a>
      <button class="nav-link" data-logout style="width:100%;text-align:left;background:none;border:none;cursor:pointer">⏻ Déconnexion</button>
      <button class="nav-link" data-theme-toggle style="width:100%;text-align:left;background:none;border:none;cursor:pointer">◐ Thème</button>
    </aside>
    <main class="admin-content">
      <?php foreach (['success' => 'alert-success', 'error' => 'alert-error'] as $k => $cls): ?>
        <?php if (!empty($flash[$k])): ?><div class="alert <?= $cls ?>"><?= e($flash[$k]) ?></div><?php endif; ?>
      <?php endforeach; ?>
      <?= $content ?>
    </main>
  </div>
  <script src="/assets/js/api.js"></script>
  <script src="/assets/js/app.js"></script>
  <script src="/assets/js/ui.js"></script>
</body>
</html>

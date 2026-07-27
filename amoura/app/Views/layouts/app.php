<?php
/** @var string $content */
/** @var array|null $auth */
use Amoura\Models\Notification;
$path = $_SERVER['REQUEST_URI'] ?? '/';
$uid = $auth['id'] ?? 0;
$unread = $uid ? (new Notification())->unreadCount((int) $uid) : 0;
$avatarPath = null;
if ($uid) {
    $p = (new \Amoura\Models\User())->fullProfile((int) $uid);
    $avatarPath = $p['avatar_path'] ?? null;
}
$nav = function (string $href, string $label, string $icon, ?string $key = null) use ($path) {
    $active = ($path === $href) || ($key && str_starts_with($path, $key)) ? ' active' : '';
    return '<a href="' . $href . '" class="nav-link' . $active . '"><span>' . $icon . '</span><span class="label">' . $label . '</span></a>';
};
?>
<!doctype html>
<html lang="fr">
<head><?php include __DIR__ . '/../partials/head.php'; ?></head>
<body data-auth="1" data-user-id="<?= (int) $uid ?>">
  <header class="app-header desktop-only">
    <div class="container row between" style="width:100%">
      <a href="/app" class="brand"><img class="logo" src="/assets/img/logo.svg" alt=""><span class="gradient-text">Amoura</span></a>
      <nav class="nav-links">
        <?= $nav('/discover', t('nav.discover'), '🔥', '/discover') ?>
        <?= $nav('/matches', t('nav.matches'), '💞', '/matches') ?>
        <?= $nav('/messages', t('nav.messages'), '💬', '/messages') ?>
        <?= $nav('/feed', t('nav.feed'), '📰', '/feed') ?>
        <?= $nav('/invite', 'Inviter', '🎁', '/invite') ?>
        <a href="/notifications" class="nav-link<?= str_starts_with($path, '/notifications') ? ' active' : '' ?>">
          <span>🔔</span><span class="label"><?= e(t('nav.alerts')) ?></span>
          <span class="nav-badge" data-notif-badge style="<?= $unread ? '' : 'display:none' ?>"><?= $unread > 99 ? '99+' : $unread ?></span>
        </a>
      </nav>
      <div class="row">
        <?php if (!empty($auth['is_staff'])): ?><a href="/admin" class="btn btn-ghost btn-sm"><?= e(t('nav.admin')) ?></a><?php endif; ?>
        <a href="/lang/<?= locale() === 'fr' ? 'en' : 'fr' ?>" class="btn btn-icon btn-ghost" title="<?= e(t('common.language')) ?>"><?= locale() === 'fr' ? 'EN' : 'FR' ?></a>
        <button class="btn btn-icon btn-ghost" data-theme-toggle title="<?= e(t('common.theme')) ?>">◐</button>
        <a href="/profile"><img class="avatar avatar-sm" src="<?= e(avatar_url($avatarPath)) ?>" alt="Profil"></a>
      </div>
    </div>
  </header>

  <main class="app-main">
    <?php foreach (['success' => 'alert-success', 'error' => 'alert-error'] as $k => $cls): ?>
      <?php if (!empty($flash[$k])): ?><div class="alert <?= $cls ?>"><?= e($flash[$k]) ?></div><?php endif; ?>
    <?php endforeach; ?>
    <?= $content ?>
  </main>

  <!-- Navigation mobile -->
  <nav class="mobile-nav">
    <?= $nav('/discover', t('nav.discover'), '🔥', '/discover') ?>
    <?= $nav('/matches', t('nav.matches'), '💞', '/matches') ?>
    <?= $nav('/messages', t('nav.messages'), '💬', '/messages') ?>
    <?= $nav('/feed', t('nav.feed'), '📰', '/feed') ?>
    <?= $nav('/profile', t('nav.profile'), '👤', '/profile') ?>
  </nav>

  <?php include __DIR__ . '/../partials/call_overlay.php'; ?>
  <?php include __DIR__ . '/../partials/story_viewer.php'; ?>

  <script src="/assets/js/api.js"></script>
  <script src="/assets/js/app.js"></script>
  <script src="/assets/js/ui.js"></script>
  <script src="/assets/js/webrtc.js"></script>
  <?php foreach (($scripts ?? []) as $s): ?><script src="/assets/js/<?= e($s) ?>"></script><?php endforeach; ?>
</body>
</html>

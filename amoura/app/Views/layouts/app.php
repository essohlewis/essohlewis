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
        <?= $nav('/discover', 'Découvrir', '🔥', '/discover') ?>
        <?= $nav('/matches', 'Matchs', '💞', '/matches') ?>
        <?= $nav('/messages', 'Messages', '💬', '/messages') ?>
        <?= $nav('/feed', 'Fil', '📰', '/feed') ?>
        <a href="/notifications" class="nav-link<?= str_starts_with($path, '/notifications') ? ' active' : '' ?>">
          <span>🔔</span><span class="label">Alertes</span>
          <span class="nav-badge" data-notif-badge style="<?= $unread ? '' : 'display:none' ?>"><?= $unread > 99 ? '99+' : $unread ?></span>
        </a>
      </nav>
      <div class="row">
        <?php if (!empty($auth['is_staff'])): ?><a href="/admin" class="btn btn-ghost btn-sm">Admin</a><?php endif; ?>
        <button class="btn btn-icon btn-ghost" data-theme-toggle title="Thème">◐</button>
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
    <?= $nav('/discover', 'Découvrir', '🔥', '/discover') ?>
    <?= $nav('/matches', 'Matchs', '💞', '/matches') ?>
    <?= $nav('/messages', 'Chat', '💬', '/messages') ?>
    <?= $nav('/feed', 'Fil', '📰', '/feed') ?>
    <?= $nav('/profile', 'Profil', '👤', '/profile') ?>
  </nav>

  <?php include __DIR__ . '/../partials/call_overlay.php'; ?>
  <?php include __DIR__ . '/../partials/story_viewer.php'; ?>

  <script src="/assets/js/api.js"></script>
  <script src="/assets/js/app.js"></script>
  <script src="/assets/js/webrtc.js"></script>
  <?php foreach (($scripts ?? []) as $s): ?><script src="/assets/js/<?= e($s) ?>"></script><?php endforeach; ?>
</body>
</html>

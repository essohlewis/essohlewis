<?php
/**
 * Layout de l'espace administration : barre latérale + zone de contenu.
 * Variables : $title, $content.
 */

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Session;

$pageTitle = $title ?? 'Administration';
$admin = Auth::user();
$flash = Session::pullFlash();
?>
<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= e($pageTitle) ?> — Admin</title>
    <link rel="stylesheet" href="<?= asset('css/style.css') ?>">
    <meta name="csrf-token" content="<?= e(Csrf::token()) ?>">
    <meta name="base-url" content="<?= e(BASE_URL) ?>">
</head>
<body class="admin-body">
    <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-brand">
            <span class="brand-mark" aria-hidden="true">📶</span>
            <span>GuideRecharge <strong>Admin</strong></span>
        </div>
        <nav class="admin-nav">
            <a href="<?= url('/admin') ?>" class="<?= active('/admin') === 'active' && $_SERVER['REQUEST_URI'] === BASE_URL . '/admin' ? 'active' : '' ?>">📊 Tableau de bord</a>
            <a href="<?= url('/admin/forfaits') ?>" class="<?= active('/admin/forfaits') ?>">📦 Forfaits</a>
            <a href="<?= url('/admin/operateurs') ?>" class="<?= active('/admin/operateurs') ?>">📡 Opérateurs</a>
            <a href="<?= url('/admin/codes') ?>" class="<?= active('/admin/codes') ?>">＃ Codes USSD</a>
            <a href="<?= url('/admin/guides') ?>" class="<?= active('/admin/guides') ?>">📖 Guides</a>
            <a href="<?= url('/') ?>" class="admin-nav-ext" target="_blank" rel="noopener">🌐 Voir le site</a>
        </nav>
    </aside>

    <div class="admin-main">
        <header class="admin-topbar">
            <button class="admin-menu-toggle" id="adminMenuToggle" aria-label="Menu">☰</button>
            <h1 class="admin-title"><?= e($pageTitle) ?></h1>
            <div class="admin-user">
                <span><?= e($admin['nom'] ?? 'Admin') ?></span>
                <form action="<?= url('/admin/logout') ?>" method="post" class="inline-form">
                    <?= Csrf::field() ?>
                    <button type="submit" class="btn btn-ghost btn-sm">Déconnexion</button>
                </form>
            </div>
        </header>

        <?php if ($flash !== []): ?>
            <div class="admin-flash">
                <?php foreach ($flash as $type => $message): ?>
                    <div class="flash flash-<?= e($type) ?>"><?= e($message) ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <div class="admin-content">
            <?= $content ?>
        </div>
    </div>

    <div class="toast-container" id="toastContainer" aria-live="polite"></div>
    <script src="<?= asset('js/app.js') ?>" defer></script>
</body>
</html>

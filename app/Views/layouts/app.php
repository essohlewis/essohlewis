<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f766e">
    <title><?= e($title ?? 'Transouscris') ?> · <?= e($appName ?? 'Transouscris') ?></title>
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="csrf-token" content="<?= e($csrf ?? '') ?>">
    <script>try{if(localStorage.getItem('transouscris_theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}</script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
    <header class="bg-teal-700 text-white shadow">
        <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/dashboard" class="font-bold text-lg tracking-tight">Transouscris</a>
            <nav class="flex items-center gap-4 text-sm">
                <a href="/dashboard" class="hover:underline hidden sm:inline">Accueil</a>
                <a href="/historique" class="hover:underline">Historique</a>
                <a href="/wallet" class="hover:underline">Portefeuille</a>
                <?php if (!empty($auth) && $auth->isAdmin()): ?>
                    <a href="/admin" class="hover:underline">Admin</a>
                <?php endif; ?>
                <button type="button" id="theme-toggle" title="Mode clair / sombre" class="hover:opacity-80 text-base">🌓</button>
                <form method="post" action="/logout" class="inline">
                    <?= csrf_field() ?>
                    <button class="hover:underline opacity-90">Déconnexion</button>
                </form>
            </nav>
        </div>
    </header>

    <main class="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <?php if ($flash = \Transouscris\Core\Session::flash('success')): ?>
            <div class="mb-4 rounded-lg bg-emerald-100 text-emerald-800 px-4 py-3"><?= e($flash) ?></div>
        <?php endif; ?>
        <?= $content ?>
    </main>

    <footer class="text-center text-xs text-slate-400 py-6">
        Transouscris · Recharge mobile & forfaits · Côte d'Ivoire
    </footer>

    <script src="/assets/js/app.js" defer></script>
</body>
</html>

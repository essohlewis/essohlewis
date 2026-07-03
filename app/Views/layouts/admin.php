<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title ?? 'Admin') ?> · Transouscris</title>
    <meta name="csrf-token" content="<?= e($csrf ?? '') ?>">
    <script>try{if(localStorage.getItem('transouscris_theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}</script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen">
    <div class="flex min-h-screen">
        <aside class="w-56 bg-slate-900 text-slate-200 p-4 hidden md:block">
            <div class="font-bold text-white mb-6">Transouscris Admin</div>
            <nav class="flex flex-col gap-2 text-sm">
                <a href="/admin" class="hover:text-white">Tableau de bord</a>
                <a href="/admin/transactions" class="hover:text-white">Transactions</a>
                <a href="/admin/agents" class="hover:text-white">Agents</a>
                <a href="/dashboard" class="hover:text-white mt-6 opacity-70">← Retour app</a>
            </nav>
        </aside>
        <main class="flex-1 p-6"><?= $content ?></main>
    </div>
</body>
</html>

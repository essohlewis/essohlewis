<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f766e">
    <title><?= e($title ?? 'Transouscris') ?></title>
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="csrf-token" content="<?= e($csrf ?? '') ?>">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
    <header class="bg-white border-b">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="font-bold text-lg text-teal-700">Transouscris</a>
            <a href="/login" class="text-sm bg-teal-700 text-white px-4 py-2 rounded-lg">Se connecter</a>
        </div>
    </header>
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-8"><?= $content ?></main>
    <footer class="text-center text-xs text-slate-400 py-6">© <?= date('Y') ?> Transouscris</footer>
    <script src="/assets/js/app.js" defer></script>
</body>
</html>

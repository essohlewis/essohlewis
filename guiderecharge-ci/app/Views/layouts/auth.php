<?php
/** Layout minimal pour la page de connexion admin. */

use App\Core\Session;

$pageTitle = $title ?? 'Connexion';
$flash = Session::pullFlash();
?>
<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= e($pageTitle) ?></title>
    <link rel="stylesheet" href="<?= asset('css/style.css') ?>">
</head>
<body class="auth-body">
    <div class="auth-wrap">
        <?php if ($flash !== []): ?>
            <?php foreach ($flash as $type => $message): ?>
                <div class="flash flash-<?= e($type) ?>"><?= e($message) ?></div>
            <?php endforeach; ?>
        <?php endif; ?>
        <?= $content ?>
    </div>
</body>
</html>

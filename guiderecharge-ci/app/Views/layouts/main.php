<?php
/**
 * Layout principal du front.
 * Variables attendues : $title (string), $content (HTML déjà rendu).
 */

use App\Core\Csrf;

$pageTitle = $title ?? APP_NAME;
?>
<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="Comparez les forfaits Orange, MTN et Moov en Côte d'Ivoire, obtenez le code USSD exact et composez-le en un clic.">
    <meta name="theme-color" content="#FF6600">
    <title><?= e($pageTitle) ?></title>

    <link rel="manifest" href="<?= url('/manifest.json') ?>">
    <link rel="icon" href="<?= asset('img/icon.svg') ?>" type="image/svg+xml">
    <link rel="apple-touch-icon" href="<?= asset('img/icon.svg') ?>">
    <link rel="stylesheet" href="<?= asset('css/style.css') ?>">

    <!-- Jeton CSRF exposé aux scripts (utilisé par les appels POST fetch). -->
    <meta name="csrf-token" content="<?= e(Csrf::token()) ?>">
    <meta name="base-url" content="<?= e(BASE_URL) ?>">
</head>
<body>
    <?php require VIEW_PATH . '/layouts/header.php'; ?>

    <main id="main-content">
        <?= $content ?>
    </main>

    <?php require VIEW_PATH . '/layouts/footer.php'; ?>

    <!-- Zone des toasts (notifications éphémères). -->
    <div class="toast-container" id="toastContainer" aria-live="polite" aria-atomic="true"></div>

    <script src="<?= asset('js/app.js') ?>" defer></script>
    <script>
        // Enregistrement du service worker (PWA / mode hors-ligne).
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('<?= url('/service-worker.js') ?>').catch(function () {});
            });
        }
    </script>
</body>
</html>

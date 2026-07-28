<?php
/** @var string $title */
use Amoura\Models\Setting;
$siteName = (new Setting())->get('site_name', 'Amoura');
$seo = $seo ?? [];
$pageTitle = isset($seo['title']) ? $seo['title'] . ' · ' . $siteName
    : (isset($title) ? $title . ' · ' . $siteName : $siteName);
$metaDescription = (string) ($seo['description']
    ?? 'Amoura — rencontrez la bonne personne. Chat, appels vidéo, statuts et bien plus.');
$appUrl = (string) \Amoura\Core\Env::get('APP_URL', '');
$reqPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
?>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($pageTitle) ?></title>
<meta name="description" content="<?= e($metaDescription) ?>">
<?= \Amoura\Services\Seo\MetaTags::render($seo, $siteName, $appUrl, $reqPath, \Amoura\Core\Security\Nonce::get()) . "\n" ?>
<meta name="csrf-token" content="<?= e($csrf ?? '') ?>">
<meta name="theme-color" content="#ff5a7e">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Amoura">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/assets/img/logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="/assets/css/app.css">
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
// Enregistrement du Service Worker (PWA installable + coquille hors-ligne).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}
</script>

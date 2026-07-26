<?php
/** @var string $title */
use Amoura\Models\Setting;
$siteName = (new Setting())->get('site_name', 'Amoura');
$pageTitle = isset($title) ? $title . ' · ' . $siteName : $siteName;
?>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($pageTitle) ?></title>
<meta name="description" content="Amoura — rencontrez la bonne personne. Chat, appels vidéo, statuts et bien plus.">
<meta name="csrf-token" content="<?= e($csrf ?? '') ?>">
<meta name="theme-color" content="#ff5a7e">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="/assets/css/app.css">

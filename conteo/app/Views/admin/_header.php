<?php /** @var string $active */ $active = $active ?? ''; ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>CONTEO — Administration</title>
    <style>
        :root{--sun:#F2A73B;--earth:#A94E2A;--leaf:#2E7D5B;--indigo:#2B3A67;--ecru:#F5EDE0;--ink:#1C1B1A}
        *{box-sizing:border-box}
        body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:var(--ecru);color:var(--ink)}
        header.top{background:var(--indigo);color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
        header.top strong{font-size:20px;color:var(--sun)}
        nav.side{display:flex;gap:6px;flex-wrap:wrap;padding:10px 24px;background:#fff;border-bottom:1px solid #e5ddcf}
        nav.side a{padding:8px 14px;border-radius:8px;text-decoration:none;color:var(--ink);font-weight:600;font-size:14px}
        nav.side a.on{background:var(--sun);color:#fff}
        main{padding:24px;max-width:1100px;margin:0 auto}
        h1{color:var(--earth)}
        table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.05)}
        th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #eee;font-size:14px}
        th{background:#faf6ee;color:var(--earth)}
        .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:24px}
        .card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
        .card .n{font-size:30px;font-weight:800;color:var(--indigo)}
        .card .l{font-size:13px;color:#777}
        .btn{display:inline-block;padding:9px 16px;background:var(--sun);color:#fff;border:0;border-radius:8px;text-decoration:none;font-weight:700;cursor:pointer;font-size:14px}
        .btn.danger{background:var(--earth)}
        .tag{padding:2px 8px;border-radius:20px;font-size:12px;font-weight:700}
        .tag.ok{background:#d4f5e4;color:#1c6b46}.tag.pending{background:#fff0d6;color:#8a6100}.tag.fail{background:#fde0dd;color:#a12820}
        input,select,textarea{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin:6px 0;font:inherit}
        label{font-weight:600;font-size:14px}
        form.inline{display:inline}
    </style>
</head>
<body>
<header class="top"><strong>CONTEO</strong><span>Administration &nbsp; <a href="/admin/logout" style="color:#F2A73B">Déconnexion</a></span></header>
<nav class="side">
    <a href="/admin" class="<?= $active==='dashboard'?'on':'' ?>">Tableau de bord</a>
    <a href="/admin/tales" class="<?= $active==='tales'?'on':'' ?>">Contes</a>
    <a href="/admin/users" class="<?= $active==='users'?'on':'' ?>">Utilisateurs</a>
    <a href="/admin/payments" class="<?= $active==='payments'?'on':'' ?>">Transactions</a>
</nav>
<main>

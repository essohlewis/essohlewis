<?php /** @var string $content */ ?>
<!doctype html>
<html lang="fr">
<head><?php include __DIR__ . '/../partials/head.php'; ?>
<style>
  /* Mise en page dédiée au reçu : sobre, imprimable, sans coque applicative. */
  body{background:#f4f2f7;color:#1c1626;font-family:Inter,system-ui,Arial,sans-serif;margin:0;padding:32px 16px}
  .receipt{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e8e4ee;border-radius:16px;
           padding:40px;box-shadow:0 8px 24px rgba(28,22,38,.06)}
  .receipt h1{font-size:1.4rem;margin:0}
  .brand-txt{background:linear-gradient(135deg,#ff5a7e,#8b5cf6);-webkit-background-clip:text;
             background-clip:text;color:transparent;font-weight:800}
  .receipt table{width:100%;border-collapse:collapse;margin:24px 0}
  .receipt th,.receipt td{text-align:left;padding:10px 0;border-bottom:1px solid #efecf4;font-size:.95rem}
  .receipt th{color:#6b6577;font-weight:600;width:42%}
  .total{font-size:1.3rem;font-weight:800}
  .badge{display:inline-block;background:#e7f8ef;color:#0b7a4b;border-radius:999px;padding:3px 12px;font-size:.8rem;font-weight:700}
  .actions{max-width:640px;margin:16px auto 0;display:flex;gap:12px;justify-content:flex-end}
  .btn{border:0;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;text-decoration:none;font-size:.9rem}
  .btn-print{background:var(--brand-500,#ff5a7e);color:#fff}
  .btn-back{background:#efecf4;color:#1c1626}
  .muted{color:#8a8397;font-size:.85rem}
  @media print{ body{background:#fff;padding:0} .receipt{border:0;box-shadow:none} .actions{display:none} }
</style>
</head>
<body data-auth="1">
  <?= $content ?>
  <script <?= \Amoura\Core\Security\Nonce::attr() ?>>
    document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  </script>
</body>
</html>

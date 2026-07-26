<?php /** @var int $tx */ ?>
<div class="card text-center" style="max-width:420px;margin:48px auto">
  <div class="skeleton" style="width:56px;height:56px;border-radius:50%;margin:0 auto 16px"></div>
  <h2>Paiement en cours…</h2>
  <p class="muted">Nous confirmons votre paiement. Cette page se rafraîchira automatiquement.</p>
</div>
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
  // Vérification serveur périodique (le retour prestataire ne suffit jamais à activer).
  setTimeout(() => location.href = '/premium/return?tx=<?= (int) $tx ?>', 4000);
</script>

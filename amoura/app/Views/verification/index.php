<?php
/**
 * Vérification de profil par selfie (membre).
 * @var bool $is_verified
 * @var ?array $request  dernière demande (status: pending|approved|rejected)
 */
$status = $request['status'] ?? null;
?>
<div style="max-width:560px;margin:0 auto">
  <h1 style="margin-bottom:8px">Vérifier mon profil</h1>
  <p class="muted" style="margin-bottom:20px">Un profil vérifié inspire confiance et reçoit plus de matchs.
    Envoyez un selfie clair de votre visage — il reste privé et sert uniquement à la vérification.</p>

  <?php if ($is_verified): ?>
    <div class="card stack" style="text-align:center">
      <div style="font-size:2.4rem">✅</div>
      <h3 style="margin:0">Profil vérifié</h3>
      <p class="muted">Votre badge vérifié est actif. Merci !</p>
    </div>

  <?php elseif ($status === 'pending'): ?>
    <div class="card stack" style="text-align:center">
      <div style="font-size:2.4rem">⏳</div>
      <h3 style="margin:0">Demande en cours d'examen</h3>
      <p class="muted">Notre équipe examine votre selfie. Vous recevrez une notification dès que c'est traité.</p>
    </div>

  <?php else: ?>
    <?php if ($status === 'rejected'): ?>
      <div class="alert alert-error">Votre précédente demande n'a pas été validée. Réessayez avec un selfie plus net,
        bien éclairé, le visage entièrement visible.</div>
    <?php endif; ?>
    <div class="card stack">
      <h3 style="margin:0">📸 Envoyer un selfie</h3>
      <ul class="muted" style="margin:0;padding-left:18px;font-size:.9rem">
        <li>Visage entièrement visible, sans lunettes de soleil ni chapeau.</li>
        <li>Bonne luminosité, image nette (pas de capture d'écran).</li>
        <li>Photo récente de vous, seul·e.</li>
      </ul>
      <form method="POST" action="/verify-profile" enctype="multipart/form-data" class="stack">
        <?= csrf_field() ?>
        <input class="input" type="file" name="selfie" accept="image/jpeg,image/png,image/webp" required>
        <button class="btn btn-primary" style="align-self:flex-start">Envoyer pour vérification</button>
      </form>
    </div>
  <?php endif; ?>

  <p class="muted" style="margin-top:16px"><a href="/settings/security" class="gradient-text">← Sécurité du compte</a></p>
</div>

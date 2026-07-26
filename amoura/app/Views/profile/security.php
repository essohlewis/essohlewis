<?php /** @var bool $totp_enabled */ /** @var ?string $setup_secret */ /** @var ?string $setup_uri */ ?>
<div style="max-width:640px;margin:0 auto">
  <h1 style="margin-bottom:16px">Sécurité du compte</h1>

  <!-- Authentification à deux facteurs -->
  <div class="card stack" style="margin-bottom:20px">
    <div class="row between">
      <h3 style="margin:0">🔐 Double authentification (2FA)</h3>
      <?php if ($totp_enabled): ?><span class="badge badge-online">Activée</span>
      <?php else: ?><span class="badge">Désactivée</span><?php endif; ?>
    </div>
    <p class="muted">Protégez votre compte avec un code temporaire généré par une application
      (Google Authenticator, Authy, FreeOTP…).</p>

    <?php if ($totp_enabled): ?>
      <form method="POST" action="/settings/2fa/disable" class="stack"
            data-confirm="Désactiver la double authentification ?">
        <?= csrf_field() ?>
        <div class="field"><label>Confirmez avec votre mot de passe</label>
          <input class="input" type="password" name="password" required></div>
        <button class="btn btn-danger">Désactiver la 2FA</button>
      </form>

    <?php elseif ($setup_secret): ?>
      <div class="card" style="background:var(--bg-subtle)">
        <p><b>1.</b> Ajoutez ce compte à votre application d'authentification :</p>
        <div style="margin:10px 0">
          <div class="muted" style="font-size:.8rem">Clé secrète (saisie manuelle) :</div>
          <code style="display:block;padding:10px;font-size:1.1rem;letter-spacing:2px;word-break:break-all"><?= e(chunk_split($setup_secret, 4, ' ')) ?></code>
        </div>
        <details><summary class="muted" style="cursor:pointer;font-size:.85rem">Afficher l'URL otpauth (QR)</summary>
          <code style="display:block;padding:8px;font-size:.75rem;word-break:break-all;margin-top:6px"><?= e($setup_uri) ?></code>
        </details>
      </div>
      <form method="POST" action="/settings/2fa/enable" class="stack">
        <?= csrf_field() ?>
        <div class="field"><label><b>2.</b> Saisissez le code affiché pour activer</label>
          <input class="input" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
                 style="letter-spacing:.3em;text-align:center"></div>
        <button class="btn btn-primary">Activer la 2FA</button>
      </form>

    <?php else: ?>
      <form method="POST" action="/settings/2fa/setup">
        <?= csrf_field() ?>
        <button class="btn btn-primary">Configurer la 2FA</button>
      </form>
    <?php endif; ?>
  </div>

  <!-- Sessions actives -->
  <div class="card stack">
    <h3 style="margin:0">🖥️ Sessions</h3>
    <p class="muted">Vous soupçonnez un accès non autorisé ? Déconnectez tous vos autres
      appareils. Votre session actuelle restera active.</p>
    <form method="POST" action="/settings/sessions/revoke"
          data-confirm="Déconnecter tous les autres appareils ?">
      <?= csrf_field() ?>
      <button class="btn btn-ghost">Déconnecter partout</button>
    </form>
  </div>

  <p class="muted" style="margin-top:16px"><a href="/profile/edit" class="gradient-text">← Modifier mon profil</a></p>
</div>

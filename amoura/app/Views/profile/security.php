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

  <!-- Appareils connus -->
  <div class="card stack">
    <h3 style="margin:0">📱 Appareils connus</h3>
    <p class="muted">Dernières connexions détectées. Une connexion inconnue déclenche une alerte.</p>
    <?php if (empty($devices)): ?>
      <p class="muted">Aucun appareil enregistré pour l'instant.</p>
    <?php else: ?>
      <ul style="list-style:none;padding:0;margin:0">
        <?php foreach ($devices as $d): ?>
          <li style="padding:8px 0;border-top:1px solid var(--border,#efecf4);font-size:.9rem">
            <span><?= e(mb_strimwidth((string) ($d['user_agent'] ?? 'Appareil inconnu'), 0, 60, '…')) ?></span>
            <span class="muted"> · <?= e((string) ($d['last_ip'] ?? '')) ?> · <?= e(date('d/m/Y H:i', strtotime((string) $d['last_seen_at']))) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>

  <!-- Confidentialité & consentements (RGPD) -->
  <div class="card stack">
    <h3 style="margin:0">🔏 Confidentialité & consentements</h3>
    <p class="muted">Gérez vos préférences. Les traitements essentiels (compte, sécurité) ne sont pas optionnels.</p>
    <form method="POST" action="/settings/consents" class="stack">
      <?= csrf_field() ?>
      <label class="row" style="gap:10px;align-items:center">
        <input type="checkbox" name="marketing" value="1" <?= !empty($consents['marketing']) ? 'checked' : '' ?>>
        <span>E-mails marketing (nouveautés, conseils, offres)</span>
      </label>
      <label class="row" style="gap:10px;align-items:center">
        <input type="checkbox" name="analytics" value="1" <?= !empty($consents['analytics']) ? 'checked' : '' ?>>
        <span>Mesure d'audience anonymisée (amélioration du service)</span>
      </label>
      <button class="btn btn-primary" style="align-self:flex-start">Enregistrer mes préférences</button>
    </form>
    <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:8px">
      <a class="btn btn-ghost" href="/settings/data/export">⬇️ Exporter mes données (RGPD)</a>
      <form method="POST" action="/settings/data/delete"
            data-confirm="Supprimer définitivement votre compte et vos données ? Cette action est irréversible.">
        <?= csrf_field() ?>
        <button class="btn btn-ghost" style="color:#b91c1c">🗑️ Supprimer mon compte</button>
      </form>
    </div>
  </div>

  <p class="muted" style="margin-top:16px"><a href="/profile/edit" class="gradient-text">← Modifier mon profil</a></p>
</div>

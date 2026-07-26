<?php $step = ($_GET['step'] ?? '') === 'reset'; ?>
<?php if (!$step): ?>
  <h2 style="margin-bottom:4px">Mot de passe oublié</h2>
  <p class="muted" style="margin-bottom:24px">Saisissez votre email pour recevoir un code.</p>
  <form method="POST" action="/forgot" class="stack">
    <?= csrf_field() ?>
    <div class="field"><label>Email</label><input class="input" type="email" name="email" required autofocus></div>
    <button class="btn btn-primary btn-block btn-lg">Envoyer le code</button>
  </form>
<?php else: ?>
  <h2 style="margin-bottom:4px">Nouveau mot de passe</h2>
  <p class="muted" style="margin-bottom:24px">Saisissez le code reçu et votre nouveau mot de passe.</p>
  <form method="POST" action="/reset" class="stack">
    <?= csrf_field() ?>
    <div class="field"><label>Code</label><input class="input" name="code" required maxlength="6"
      inputmode="numeric" style="letter-spacing:.3em;text-align:center"></div>
    <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="password" required minlength="8"></div>
    <div class="field"><label>Confirmer</label><input class="input" type="password" name="password_confirm" required></div>
    <button class="btn btn-primary btn-block btn-lg">Réinitialiser</button>
  </form>
<?php endif; ?>
<p class="muted text-center" style="margin-top:20px"><a href="/login" class="gradient-text">← Retour connexion</a></p>

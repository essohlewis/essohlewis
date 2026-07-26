<h2 style="margin-bottom:4px">Vérification en deux étapes</h2>
<p class="muted" style="margin-bottom:24px">Saisissez le code à 6 chiffres généré par votre application d'authentification.</p>
<form method="POST" action="/2fa" class="stack">
  <?= csrf_field() ?>
  <div class="field"><label>Code de vérification</label>
    <input class="input" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
           autocomplete="one-time-code" autofocus
           style="letter-spacing:.4em;text-align:center;font-size:1.4rem"></div>
  <button class="btn btn-primary btn-block btn-lg">Vérifier</button>
</form>
<p class="muted text-center" style="margin-top:20px">
  <a href="/login" class="gradient-text">← Utiliser un autre compte</a>
</p>

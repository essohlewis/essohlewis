<h2 style="margin-bottom:4px">Connexion</h2>
<p class="muted" style="margin-bottom:24px">Content de vous revoir.</p>
<form method="POST" action="/login" class="stack">
  <?= csrf_field() ?>
  <div class="field"><label>Email</label>
    <input class="input" type="email" name="email" required autofocus></div>
  <div class="field"><label>Mot de passe</label>
    <input class="input" type="password" name="password" required></div>
  <div class="row between">
    <label class="checkbox"><input type="checkbox" name="remember" value="1"> <span class="hint">Se souvenir de moi</span></label>
    <a href="/forgot" class="hint gradient-text">Mot de passe oublié ?</a>
  </div>
  <button class="btn btn-primary btn-block btn-lg">Se connecter</button>
</form>
<p class="muted text-center" style="margin-top:20px">Pas encore de compte ? <a href="/register" class="gradient-text">S'inscrire</a></p>

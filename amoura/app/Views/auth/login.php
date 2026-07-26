<h2 style="margin-bottom:4px"><?= e(t('auth.login_title')) ?></h2>
<p class="muted" style="margin-bottom:24px"><?= e(t('auth.login_sub')) ?></p>
<form method="POST" action="/login" class="stack">
  <?= csrf_field() ?>
  <div class="field"><label><?= e(t('auth.email')) ?></label>
    <input class="input" type="email" name="email" required autofocus></div>
  <div class="field"><label><?= e(t('auth.password')) ?></label>
    <input class="input" type="password" name="password" required></div>
  <div class="row between">
    <label class="checkbox"><input type="checkbox" name="remember" value="1"> <span class="hint"><?= e(t('auth.remember')) ?></span></label>
    <a href="/forgot" class="hint gradient-text"><?= e(t('auth.forgot')) ?></a>
  </div>
  <button class="btn btn-primary btn-block btn-lg"><?= e(t('nav.login')) ?></button>
</form>
<p class="muted text-center" style="margin-top:20px"><?= e(t('auth.no_account')) ?> <a href="/register" class="gradient-text"><?= e(t('nav.register')) ?></a></p>

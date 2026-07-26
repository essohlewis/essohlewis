<?php /** @var string|null $destination */ ?>
<h2 style="margin-bottom:4px">Vérifiez votre email</h2>
<p class="muted" style="margin-bottom:24px">Un code à 6 chiffres a été envoyé à <b><?= e($destination ?? 'votre adresse') ?></b>.</p>
<form method="POST" action="/verify" class="stack">
  <?= csrf_field() ?>
  <div class="field"><label>Code de vérification</label>
    <input class="input" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
           style="letter-spacing:.4em;text-align:center;font-size:1.4rem" autofocus></div>
  <button class="btn btn-primary btn-block btn-lg">Vérifier</button>
</form>
<p class="muted text-center" style="margin-top:20px">
  <button class="btn btn-ghost btn-sm" id="resendBtn">Renvoyer le code</button>
</p>
<script>
document.getElementById('resendBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await Api.post('/verify/resend'); Amoura.toast('Nouveau code envoyé.'); }
  catch (err) { Amoura.toast(err.message); }
});
</script>

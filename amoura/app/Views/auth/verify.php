<?php /** @var string|null $destination */ ?>
<h2 style="margin-bottom:4px">Vérifiez votre compte</h2>
<p class="muted" style="margin-bottom:24px">Un code à 6 chiffres vous a été envoyé sur <b>WhatsApp</b>. Saisissez-le ci-dessous.</p>
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
<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
document.getElementById('resendBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const r = await Api.post('/verify/resend');
    Amoura.toast(r && r.dev_code ? ('Mode dev — votre code : ' + r.dev_code) : 'Nouveau code envoyé.');
  } catch (err) { Amoura.toast(err.message); }
});
</script>

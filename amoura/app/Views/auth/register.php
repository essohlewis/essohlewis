<h2 style="margin-bottom:4px">Créer un compte</h2>
<p class="muted" style="margin-bottom:24px">Gratuit et rapide.</p>
<?php $ref = $ref ?? ''; ?>
<?php if ($ref !== ''): ?>
  <div class="alert alert-success">🎁 Vous avez été invité·e ! Créez votre compte et recevez
    <strong><?= \Amoura\Models\Referral::REFEREE_BONUS ?> Super Likes</strong> offerts.</div>
<?php endif; ?>
<form method="POST" action="/register" class="stack">
  <?= csrf_field() ?>
  <?php if ($ref !== ''): ?><input type="hidden" name="ref" value="<?= e($ref) ?>"><?php endif; ?>
  <div class="field"><label>Prénom / pseudo</label>
    <input class="input" name="display_name" required maxlength="100" value="<?= e(old('display_name')) ?>"></div>
  <div class="field"><label>Email</label>
    <input class="input" type="email" name="email" required value="<?= e(old('email')) ?>"></div>
  <div class="field"><label>Numéro WhatsApp</label>
    <input class="input" type="tel" name="phone" required placeholder="+225 07 00 00 00 00" value="<?= e(old('phone')) ?>">
    <div class="hint">Votre code de vérification vous sera envoyé sur WhatsApp.</div></div>
  <div class="row">
    <div class="field grow"><label>Date de naissance</label>
      <input class="input" type="date" name="birthdate" required></div>
    <div class="field grow"><label>Genre</label>
      <select class="select" name="gender" required>
        <option value="female">Femme</option><option value="male">Homme</option>
        <option value="nonbinary">Non-binaire</option><option value="other">Autre</option>
      </select></div>
  </div>
  <div class="field"><label>Mot de passe</label>
    <input class="input" type="password" name="password" required minlength="8">
    <div class="hint">8 caractères minimum, lettres et chiffres.</div></div>
  <div class="field"><label>Confirmer le mot de passe</label>
    <input class="input" type="password" name="password_confirm" required></div>
  <label class="checkbox"><input type="checkbox" name="accept_terms" value="1" required>
    <span class="hint">J'ai 18 ans ou plus et j'accepte les <a href="/p/terms" class="gradient-text">CGU</a> et la <a href="/p/privacy" class="gradient-text">confidentialité</a>.</span></label>
  <label class="checkbox"><input type="checkbox" name="accept_marketing" value="1">
    <span class="hint">J'accepte de recevoir des e-mails avec des conseils et des offres (facultatif, révocable à tout moment).</span></label>
  <button class="btn btn-primary btn-block btn-lg">Créer mon compte</button>
</form>
<p class="muted text-center" style="margin-top:20px">Déjà inscrit ? <a href="/login" class="gradient-text">Se connecter</a></p>

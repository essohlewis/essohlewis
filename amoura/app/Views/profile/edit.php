<?php
/** @var array $profile */ /** @var array $raw */ /** @var array $photos */ /** @var array $privacy */
$interests = implode(', ', json_decode($raw['interests'] ?? '[]', true) ?: []);
$languages = implode(', ', json_decode($raw['languages'] ?? '[]', true) ?: []);
?>
<div style="max-width:640px;margin:0 auto">
  <h1 style="margin-bottom:16px">Modifier mon profil</h1>

  <div class="card" style="margin-bottom:20px">
    <div class="row between"><h3>Complétude du profil</h3><b><?= (int) ($raw['completion'] ?? 0) ?>%</b></div>
    <div class="completion-bar" style="margin-top:8px"><i style="width:<?= (int) ($raw['completion'] ?? 0) ?>%"></i></div>
  </div>

  <!-- Photos -->
  <div class="card" style="margin-bottom:20px">
    <h3 style="margin-bottom:12px">Mes photos</h3>
    <div class="photo-grid" id="photoGrid">
      <?php foreach ($photos as $ph): ?>
        <div class="cell" data-photo="<?= (int) $ph['id'] ?>">
          <img src="<?= e('/uploads/' . ($ph['thumb_path'] ?: $ph['path'])) ?>" alt="">
          <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px">
            <?php if (!$ph['is_primary']): ?><button class="btn btn-sm" onclick="setPrimary(<?= (int) $ph['id'] ?>)" title="Photo principale">★</button><?php endif; ?>
            <button class="btn btn-sm btn-danger" onclick="delPhoto(<?= (int) $ph['id'] ?>)">✕</button>
          </div>
          <?php if ($ph['is_primary']): ?><span class="badge badge-premium" style="position:absolute;bottom:4px;left:4px">Principale</span><?php endif; ?>
        </div>
      <?php endforeach; ?>
      <label class="cell" style="display:grid;place-items:center;cursor:pointer;border:2px dashed var(--border-strong)">
        <span style="font-size:2rem;color:var(--brand-500)">+</span>
        <input type="file" id="photoInput" accept="image/*" hidden>
      </label>
    </div>
    <div class="hint">Jusqu'à 9 photos. La première est votre photo principale.</div>
  </div>

  <!-- Informations -->
  <form method="POST" action="/profile" class="card stack" style="margin-bottom:20px">
    <?= csrf_field() ?>
    <h3>Informations</h3>
    <div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="1000"><?= e($raw['bio'] ?? '') ?></textarea></div>
    <div class="row">
      <div class="field grow"><label>Pays (code ISO, ex: CI)</label><input class="input" name="country" maxlength="2" value="<?= e($raw['country'] ?? '') ?>"></div>
      <div class="field grow"><label>Ville</label><input class="input" name="city" value="<?= e($raw['city'] ?? '') ?>"></div>
    </div>
    <div class="row">
      <div class="field grow"><label>Orientation</label>
        <select class="select" name="orientation">
          <?php foreach (['straight'=>'Hétéro','gay'=>'Gay','lesbian'=>'Lesbienne','bisexual'=>'Bisexuel(le)','pansexual'=>'Pansexuel(le)','asexual'=>'Asexuel(le)','other'=>'Autre'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($raw['orientation'] ?? '') === $k ? 'selected' : '' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select></div>
      <div class="field grow"><label>Je recherche</label>
        <select class="select" name="looking_for">
          <option value="everyone" <?= ($raw['looking_for'] ?? '')==='everyone'?'selected':'' ?>>Tout le monde</option>
          <option value="female" <?= ($raw['looking_for'] ?? '')==='female'?'selected':'' ?>>Des femmes</option>
          <option value="male" <?= ($raw['looking_for'] ?? '')==='male'?'selected':'' ?>>Des hommes</option>
        </select></div>
    </div>
    <div class="field"><label>Centres d'intérêt (séparés par des virgules)</label>
      <input class="input" name="interests" value="<?= e($interests) ?>" placeholder="voyage, musique, sport"></div>
    <div class="field"><label>Langues parlées</label>
      <input class="input" name="languages" value="<?= e($languages) ?>" placeholder="fr, en"></div>
    <div class="row">
      <div class="field grow"><label>Profession</label><input class="input" name="job_title" value="<?= e($raw['job_title'] ?? '') ?>"></div>
      <div class="field grow"><label>Formation</label><input class="input" name="education" value="<?= e($raw['education'] ?? '') ?>"></div>
    </div>
    <input type="hidden" name="latitude" id="lat" value="<?= e($raw['latitude'] ?? '') ?>">
    <input type="hidden" name="longitude" id="lng" value="<?= e($raw['longitude'] ?? '') ?>">
    <div class="row">
      <button class="btn btn-primary grow">Enregistrer</button>
      <button type="button" class="btn btn-ghost" onclick="geolocate()">📍 Ma position</button>
    </div>
  </form>

  <!-- Confidentialité -->
  <form method="POST" action="/profile/privacy" class="card stack" style="margin-bottom:20px">
    <?= csrf_field() ?>
    <h3>Confidentialité</h3>
    <?php foreach ([
        'discoverable'=>'Apparaître dans la découverte','show_online'=>'Afficher mon statut en ligne',
        'show_distance'=>'Afficher ma distance','show_age'=>'Afficher mon âge',
        'read_receipts'=>'Accusés de lecture'] as $k=>$label): ?>
      <label class="checkbox"><input type="checkbox" name="<?= $k ?>" value="1" <?= !empty($privacy[$k]) ? 'checked' : '' ?>> <?= $label ?></label>
    <?php endforeach; ?>
    <div class="field"><label>Qui peut m'écrire</label>
      <select class="select" name="allow_messages_from">
        <option value="matches" <?= ($privacy['allow_messages_from'] ?? '')==='matches'?'selected':'' ?>>Mes matchs uniquement</option>
        <option value="verified" <?= ($privacy['allow_messages_from'] ?? '')==='verified'?'selected':'' ?>>Membres vérifiés</option>
        <option value="everyone" <?= ($privacy['allow_messages_from'] ?? '')==='everyone'?'selected':'' ?>>Tout le monde</option>
      </select></div>
    <button class="btn btn-primary">Enregistrer</button>
  </form>

  <!-- Vérification + RGPD -->
  <div class="card stack">
    <h3>Vérification & données</h3>
    <form onsubmit="return verifyProfile(event)">
      <label class="btn btn-ghost btn-block">📸 Demander le badge vérifié (selfie)
        <input type="file" id="selfieInput" accept="image/*" hidden></label>
    </form>
    <a href="/settings/data/export" class="btn btn-ghost btn-block">⬇️ Exporter mes données (RGPD)</a>
    <form method="POST" action="/settings/data/delete" onsubmit="return confirm('Supprimer définitivement votre compte ?')">
      <?= csrf_field() ?>
      <button class="btn btn-danger btn-block">Supprimer mon compte</button>
    </form>
  </div>
</div>

<script>
document.getElementById('photoInput').addEventListener('change', async (e)=>{
  if(!e.target.files[0]) return;
  const fd = new FormData(); fd.append('photo', e.target.files[0]);
  try { await Api.upload('/profile/photos', fd); location.reload(); } catch(err){ Amoura.toast(err.message); }
});
async function setPrimary(id){ await Api.post('/profile/photos/'+id+'/primary'); location.reload(); }
async function delPhoto(id){ if(!confirm('Supprimer cette photo ?'))return; await Api.del('/profile/photos/'+id); location.reload(); }
function geolocate(){ navigator.geolocation?.getCurrentPosition(p=>{
  document.getElementById('lat').value=p.coords.latitude; document.getElementById('lng').value=p.coords.longitude;
  Amoura.toast('Position enregistrée, cliquez sur Enregistrer.'); }); }
async function verifyProfile(e){ e.preventDefault();
  const input=document.getElementById('selfieInput'); if(!input.files[0]){input.click();return false;}
  const fd=new FormData(); fd.append('selfie',input.files[0]);
  try{const r=await Api.upload('/profile/verify',fd); Amoura.toast(r.message);}catch(err){Amoura.toast(err.message);} return false; }
document.getElementById('selfieInput').addEventListener('change',()=>verifyProfile(new Event('x')));
</script>

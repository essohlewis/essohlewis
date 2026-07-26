<?php $scripts = ['social.js']; ?>
<div class="feed">
  <!-- Statuts (stories) -->
  <div class="card" style="margin-bottom:20px">
    <div class="stories-bar" id="storiesBar">
      <div class="story-item story-add-item" data-modal-open="storyDialog">
        <div class="story-add">+</div><span>Mon statut</span>
      </div>
    </div>
  </div>

  <!-- Composer de publication -->
  <form class="card" id="postComposer" style="margin-bottom:20px" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="composer">
      <img class="avatar avatar-md" src="<?= e(avatar_url(null)) ?>" alt="">
      <textarea class="textarea grow" name="body" placeholder="Quoi de neuf ?" maxlength="3000" style="min-height:60px"></textarea>
    </div>
    <div id="composerPreview" class="post-media" style="margin-top:8px"></div>
    <div class="row between" style="margin-top:12px">
      <div class="row">
        <label class="btn btn-ghost btn-sm">🖼️ Photos<input type="file" name="media[]" accept="image/*" multiple hidden id="postMedia"></label>
        <select class="select" name="visibility" style="width:auto">
          <option value="public">🌍 Public</option><option value="matches">💞 Mes matchs</option><option value="private">🔒 Privé</option>
        </select>
      </div>
      <button class="btn btn-primary">Publier</button>
    </div>
  </form>

  <div id="feed"></div>
</div>

<!-- Dialogue de création de statut -->
<dialog id="storyDialog" class="card" style="border:none;border-radius:var(--r-lg);max-width:420px;width:90%">
  <h3 style="margin-bottom:12px">Nouveau statut</h3>
  <form id="storyForm" enctype="multipart/form-data" class="stack">
    <?= csrf_field() ?>
    <div class="row">
      <label class="checkbox"><input type="radio" name="type" value="image" checked data-action-change="toggleStoryType"> Image</label>
      <label class="checkbox"><input type="radio" name="type" value="text" data-action-change="toggleStoryType"> Texte</label>
    </div>
    <div id="storyImageField"><input type="file" name="media" accept="image/*" class="input"></div>
    <div id="storyTextField" style="display:none">
      <input class="input" name="background" placeholder="Couleur de fond (ex: #ff5a7e)" value="var(--gradient-brand)">
    </div>
    <textarea class="textarea" name="caption" placeholder="Légende / texte…" maxlength="500"></textarea>
    <div class="row between">
      <button type="button" class="btn btn-ghost" data-modal-close="storyDialog">Annuler</button>
      <button class="btn btn-primary" data-modal-close="storyDialog">Publier</button>
    </div>
  </form>
</dialog>

<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
function toggleStoryType(){
  const t = document.querySelector('input[name=type]:checked').value;
  document.getElementById('storyImageField').style.display = t==='image'?'block':'none';
  document.getElementById('storyTextField').style.display = t==='text'?'block':'none';
}
// Aperçu des images du composer.
document.getElementById('postMedia')?.addEventListener('change', (e)=>{
  const prev=document.getElementById('composerPreview'); prev.innerHTML='';
  [...e.target.files].slice(0,4).forEach(f=>{ const img=new Image(); img.src=URL.createObjectURL(f); prev.appendChild(img); });
  prev.className='post-media n'+Math.min(e.target.files.length,4);
});
</script>

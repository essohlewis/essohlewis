<?php /** @var array $pages */ ?>
<h1 style="margin-bottom:20px">Pages CMS</h1>
<p class="muted" style="margin-bottom:20px">Éditez les pages statiques (CGU, confidentialité, à propos, FAQ) ou créez-en de nouvelles.</p>

<?php foreach ($pages as $p): ?>
  <details class="card" style="margin-bottom:16px">
    <summary style="cursor:pointer;font-weight:700"><?= e($p['title']) ?> <span class="muted">/p/<?= e($p['slug']) ?></span></summary>
    <form method="POST" action="/admin/pages" class="stack" style="margin-top:16px">
      <?= csrf_field() ?>
      <input type="hidden" name="slug" value="<?= e($p['slug']) ?>">
      <div class="field"><label>Titre</label><input class="input" name="title" value="<?= e($p['title']) ?>"></div>
      <div class="field"><label>Contenu (HTML simple autorisé)</label>
        <textarea class="textarea" name="content" style="min-height:200px;font-family:monospace"><?= e($p['content']) ?></textarea></div>
      <label class="checkbox"><input type="checkbox" name="is_published" value="1" <?= $p['is_published']?'checked':'' ?>> Publiée</label>
      <button class="btn btn-primary">Enregistrer</button>
    </form>
  </details>
<?php endforeach; ?>

<details class="card">
  <summary style="cursor:pointer;font-weight:700">+ Nouvelle page</summary>
  <form method="POST" action="/admin/pages" class="stack" style="margin-top:16px">
    <?= csrf_field() ?>
    <div class="field"><label>Slug (URL)</label><input class="input" name="slug" placeholder="ma-page" required></div>
    <div class="field"><label>Titre</label><input class="input" name="title" required></div>
    <div class="field"><label>Contenu</label><textarea class="textarea" name="content" style="min-height:160px"></textarea></div>
    <label class="checkbox"><input type="checkbox" name="is_published" value="1" checked> Publiée</label>
    <button class="btn btn-primary">Créer</button>
  </form>
</details>

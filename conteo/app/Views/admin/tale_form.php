<?php
use App\Helpers\Csrf;
use App\Helpers\Sanitize;
/** @var array $packs */
?>
<h1>Nouveau conte</h1>
<form method="post" action="/admin/tales" style="max-width:640px;background:#fff;padding:24px;border-radius:14px">
    <?= Csrf::field() ?>
    <label>Titre</label>
    <input name="title" required placeholder="Kacou Ananzè et le baobab">
    <label>Slug (laisser vide = auto)</label>
    <input name="slug" placeholder="kacou-ananze-et-le-baobab">
    <label>Origine</label>
    <input name="origin" placeholder="Akan, Mandingue, Peul...">
    <label>Morale</label>
    <textarea name="moral" rows="2" placeholder="La ruse ne remplace jamais le travail."></textarea>
    <label>URL de couverture</label>
    <input name="cover_url" placeholder="/media/tales/kacou-baobab/cover.webp">
    <label>Pack (optionnel)</label>
    <select name="pack_id">
        <option value="">— Aucun (hors pack) —</option>
        <?php foreach ($packs as $p): ?>
            <option value="<?= (int)$p['id'] ?>"><?= Sanitize::html($p['title']) ?></option>
        <?php endforeach; ?>
    </select>
    <label>Ordre d'affichage</label>
    <input name="sort_order" type="number" value="0">
    <p><label><input type="checkbox" name="is_free" style="width:auto"> Conte gratuit</label></p>
    <p><label><input type="checkbox" name="published" style="width:auto"> Publier immédiatement</label></p>
    <button class="btn" type="submit">Enregistrer</button>
    <a href="/admin/tales" style="margin-left:8px">Annuler</a>
</form>
<p style="color:#777;font-size:13px;margin-top:16px">
    Après création, ajoutez les 3 versions (N1/N2/N3) et les pistes audio via la base
    (tables <code>tale_versions</code>, <code>tale_audio</code>) en pointant vers les manifests JSON.
    Un exemple complet est fourni dans <code>public/media/tales/kacou-baobab/</code>.
</p>

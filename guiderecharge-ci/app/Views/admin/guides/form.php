<?php
/**
 * Formulaire guide (création/édition).
 * Variables : $guide (ou null), $operateurs.
 */

use App\Core\Csrf;

/** @var array<string,mixed>|null $guide */
/** @var array<int,array<string,mixed>> $operateurs */
$isEdit = $guide !== null;
$action = $isEdit ? url('/admin/guides/' . (int) $guide['id']) : url('/admin/guides');
?>
<a href="<?= url('/admin/guides') ?>" class="admin-back">← Retour à la liste</a>

<form action="<?= e($action) ?>" method="post" class="admin-form">
    <?= Csrf::field() ?>

    <div class="admin-form-grid">
        <div class="field field-wide">
            <label for="titre">Titre *</label>
            <input type="text" id="titre" name="titre" required value="<?= e($guide['titre'] ?? '') ?>" placeholder="Comment transférer du crédit Orange">
        </div>
        <div class="field">
            <label for="slug">Slug</label>
            <input type="text" id="slug" name="slug" value="<?= e($guide['slug'] ?? '') ?>" placeholder="auto si vide">
        </div>
        <div class="field">
            <label for="categorie">Catégorie</label>
            <input type="text" id="categorie" name="categorie" value="<?= e($guide['categorie'] ?? '') ?>" placeholder="Transfert, Activation, Réclamation…">
        </div>
        <div class="field">
            <label for="operateur_id">Opérateur (optionnel)</label>
            <select id="operateur_id" name="operateur_id">
                <option value="">— Tous / Général —</option>
                <?php foreach ($operateurs as $op): ?>
                    <option value="<?= (int) $op['id'] ?>" <?= (int) ($guide['operateur_id'] ?? 0) === (int) $op['id'] ? 'selected' : '' ?>>
                        <?= e($op['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="field">
            <label for="image">Image (chemin/URL)</label>
            <input type="text" id="image" name="image" value="<?= e($guide['image'] ?? '') ?>" placeholder="img/guide-transfert.jpg">
        </div>
        <div class="field field-wide">
            <label for="contenu">Contenu (HTML riche) *</label>
            <textarea id="contenu" name="contenu" rows="12" required placeholder="&lt;h2&gt;Étape 1&lt;/h2&gt;&lt;p&gt;…&lt;/p&gt;"><?= e($guide['contenu'] ?? '') ?></textarea>
            <div class="field-hint">Balises autorisées : titres, paragraphes, listes, gras, liens. Les scripts sont automatiquement retirés.</div>
        </div>
    </div>

    <label class="switch-field">
        <input type="checkbox" name="actif" value="1" <?= (!$isEdit || (int) ($guide['actif'] ?? 0) === 1) ? 'checked' : '' ?>>
        <span>Publier le guide</span>
    </label>

    <div class="admin-form-actions">
        <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Enregistrer' : 'Créer le guide' ?></button>
        <a href="<?= url('/admin/guides') ?>" class="btn btn-ghost">Annuler</a>
    </div>
</form>

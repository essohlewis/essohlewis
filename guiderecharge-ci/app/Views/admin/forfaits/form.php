<?php
/**
 * Formulaire forfait (création/édition).
 * Variables : $forfait (ou null), $operateurs, $categories.
 */

use App\Core\Csrf;

/** @var array<string,mixed>|null $forfait */
/** @var array<int,array<string,mixed>> $operateurs */
/** @var array<int,array<string,mixed>> $categories */
$isEdit = $forfait !== null;
$action = $isEdit ? url('/admin/forfaits/' . (int) $forfait['id']) : url('/admin/forfaits');
?>
<a href="<?= url('/admin/forfaits') ?>" class="admin-back">← Retour à la liste</a>

<form action="<?= e($action) ?>" method="post" class="admin-form">
    <?= Csrf::field() ?>

    <div class="admin-form-grid">
        <div class="field field-wide">
            <label for="nom">Nom du forfait *</label>
            <input type="text" id="nom" name="nom" required value="<?= e($forfait['nom'] ?? '') ?>" placeholder="Pass Internet 5 Go">
        </div>

        <div class="field">
            <label for="operateur_id">Opérateur *</label>
            <select id="operateur_id" name="operateur_id" required>
                <option value="">— Choisir —</option>
                <?php foreach ($operateurs as $op): ?>
                    <option value="<?= (int) $op['id'] ?>" <?= (int) ($forfait['operateur_id'] ?? 0) === (int) $op['id'] ? 'selected' : '' ?>>
                        <?= e($op['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="field">
            <label for="categorie_id">Catégorie *</label>
            <select id="categorie_id" name="categorie_id" required>
                <option value="">— Choisir —</option>
                <?php foreach ($categories as $cat): ?>
                    <option value="<?= (int) $cat['id'] ?>" <?= (int) ($forfait['categorie_id'] ?? 0) === (int) $cat['id'] ? 'selected' : '' ?>>
                        <?= e($cat['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="field">
            <label for="prix">Prix (FCFA) *</label>
            <input type="number" id="prix" name="prix" required min="0" step="50" value="<?= e($forfait['prix'] ?? '') ?>">
        </div>
        <div class="field">
            <label for="validite">Validité</label>
            <input type="text" id="validite" name="validite" value="<?= e($forfait['validite'] ?? '') ?>" placeholder="30 jours">
        </div>
        <div class="field">
            <label for="volume_data">Volume data</label>
            <input type="text" id="volume_data" name="volume_data" value="<?= e($forfait['volume_data'] ?? '') ?>" placeholder="5 Go">
        </div>
        <div class="field">
            <label for="minutes_appel">Minutes d'appel</label>
            <input type="text" id="minutes_appel" name="minutes_appel" value="<?= e($forfait['minutes_appel'] ?? '') ?>" placeholder="60 min">
        </div>
        <div class="field">
            <label for="sms">SMS</label>
            <input type="text" id="sms" name="sms" value="<?= e($forfait['sms'] ?? '') ?>" placeholder="100 SMS">
        </div>
        <div class="field field-wide">
            <label for="code_ussd">Code d'activation USSD</label>
            <input type="text" id="code_ussd" name="code_ussd" value="<?= e($forfait['code_ussd'] ?? '') ?>" placeholder="*123*1*5#">
            <div class="field-hint">Placeholders possibles : {numero}, {montant}, {code}.</div>
        </div>
        <div class="field field-wide">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="3" placeholder="Décrivez le forfait…"><?= e($forfait['description'] ?? '') ?></textarea>
        </div>
    </div>

    <div class="switch-row">
        <label class="switch-field">
            <input type="checkbox" name="populaire" value="1" <?= (int) ($forfait['populaire'] ?? 0) === 1 ? 'checked' : '' ?>>
            <span>Marquer « Populaire »</span>
        </label>
        <label class="switch-field">
            <input type="checkbox" name="actif" value="1" <?= (!$isEdit || (int) ($forfait['actif'] ?? 0) === 1) ? 'checked' : '' ?>>
            <span>Forfait actif</span>
        </label>
    </div>

    <div class="admin-form-actions">
        <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Enregistrer' : 'Créer le forfait' ?></button>
        <a href="<?= url('/admin/forfaits') ?>" class="btn btn-ghost">Annuler</a>
    </div>
</form>

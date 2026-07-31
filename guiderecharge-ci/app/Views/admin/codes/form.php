<?php
/**
 * Formulaire code USSD (création/édition).
 * Variables : $code (ou null), $operateurs, $actions.
 */

use App\Core\Csrf;

/** @var array<string,mixed>|null $code */
/** @var array<int,array<string,mixed>> $operateurs */
/** @var array<string,string> $actions */
$isEdit = $code !== null;
$action = $isEdit ? url('/admin/codes/' . (int) $code['id']) : url('/admin/codes');
?>
<a href="<?= url('/admin/codes') ?>" class="admin-back">← Retour à la liste</a>

<form action="<?= e($action) ?>" method="post" class="admin-form">
    <?= Csrf::field() ?>

    <div class="admin-form-grid">
        <div class="field">
            <label for="operateur_id">Opérateur *</label>
            <select id="operateur_id" name="operateur_id" required>
                <option value="">— Choisir —</option>
                <?php foreach ($operateurs as $op): ?>
                    <option value="<?= (int) $op['id'] ?>" <?= (int) ($code['operateur_id'] ?? 0) === (int) $op['id'] ? 'selected' : '' ?>>
                        <?= e($op['nom']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="field">
            <label for="action">Action *</label>
            <select id="action" name="action" required>
                <?php foreach ($actions as $key => $label): ?>
                    <option value="<?= e($key) ?>" <?= ($code['action'] ?? '') === $key ? 'selected' : '' ?>><?= e($label) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="field field-wide">
            <label for="libelle">Libellé *</label>
            <input type="text" id="libelle" name="libelle" required value="<?= e($code['libelle'] ?? '') ?>" placeholder="Achat de crédit">
        </div>
        <div class="field field-wide">
            <label for="pattern">Pattern USSD *</label>
            <input type="text" id="pattern" name="pattern" required value="<?= e($code['pattern'] ?? '') ?>" placeholder="*155*1*1*{numero}*{montant}#">
            <div class="field-hint">Placeholders : {numero}, {montant}, {code}.</div>
        </div>
        <div class="field field-wide">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="2" placeholder="Notes d'utilisation…"><?= e($code['description'] ?? '') ?></textarea>
        </div>
    </div>

    <div class="admin-form-actions">
        <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Enregistrer' : 'Créer le code' ?></button>
        <a href="<?= url('/admin/codes') ?>" class="btn btn-ghost">Annuler</a>
    </div>
</form>

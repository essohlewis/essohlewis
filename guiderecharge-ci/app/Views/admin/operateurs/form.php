<?php
/**
 * Formulaire opérateur (création/édition).
 * Variable : $operateur (tableau ou null).
 */

use App\Core\Csrf;

/** @var array<string,mixed>|null $operateur */
$isEdit = $operateur !== null;
$action = $isEdit ? url('/admin/operateurs/' . (int) $operateur['id']) : url('/admin/operateurs');
?>
<a href="<?= url('/admin/operateurs') ?>" class="admin-back">← Retour à la liste</a>

<form action="<?= e($action) ?>" method="post" class="admin-form">
    <?= Csrf::field() ?>

    <div class="admin-form-grid">
        <div class="field">
            <label for="nom">Nom *</label>
            <input type="text" id="nom" name="nom" required value="<?= e($operateur['nom'] ?? '') ?>" placeholder="Orange">
        </div>
        <div class="field">
            <label for="slug">Slug</label>
            <input type="text" id="slug" name="slug" value="<?= e($operateur['slug'] ?? '') ?>" placeholder="orange (auto si vide)">
        </div>
        <div class="field">
            <label for="couleur_hex">Couleur (hex) *</label>
            <input type="color" id="couleur_hex" name="couleur_hex" value="<?= e($operateur['couleur_hex'] ?? '#FF6600') ?>">
        </div>
        <div class="field">
            <label for="logo">Logo (chemin/URL)</label>
            <input type="text" id="logo" name="logo" value="<?= e($operateur['logo'] ?? '') ?>" placeholder="img/orange.svg">
        </div>
        <div class="field">
            <label for="prefixes">Préfixes</label>
            <input type="text" id="prefixes" name="prefixes" value="<?= e($operateur['prefixes'] ?? '') ?>" placeholder="07">
            <div class="field-hint">CSV ou JSON. Orange → 07, MTN → 05, Moov → 01.</div>
        </div>
        <div class="field">
            <label for="ussd_base">Code racine USSD</label>
            <input type="text" id="ussd_base" name="ussd_base" value="<?= e($operateur['ussd_base'] ?? '') ?>" placeholder="*144#">
        </div>
    </div>

    <label class="switch-field">
        <input type="checkbox" name="actif" value="1" <?= (!$isEdit || (int) ($operateur['actif'] ?? 0) === 1) ? 'checked' : '' ?>>
        <span>Opérateur actif</span>
    </label>

    <div class="admin-form-actions">
        <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Enregistrer' : 'Créer l\'opérateur' ?></button>
        <a href="<?= url('/admin/operateurs') ?>" class="btn btn-ghost">Annuler</a>
    </div>
</form>

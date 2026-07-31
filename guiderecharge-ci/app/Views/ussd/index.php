<?php
/**
 * Générateur de code USSD (fonctionnalité phare).
 * Variables : $operateurs, $patterns (codes par slug), $montant_min, $montant_max.
 */
/** @var array<int,array<string,mixed>> $operateurs */
/** @var array<string,array<int,array<string,mixed>>> $patterns */
/** @var int $montant_min */
/** @var int $montant_max */
?>
<section class="page-head">
    <div class="container">
        <h1>Générateur de code USSD</h1>
        <p>Saisissez votre numéro : on détecte votre opérateur automatiquement. Choisissez l'action, on génère le code exact prêt à composer.</p>
    </div>
</section>

<section class="container ussd-wrap">
    <form class="ussd-form" id="ussdForm" novalidate>
        <div class="field">
            <label for="ussdNumero">Votre numéro (ou celui du destinataire)</label>
            <input type="tel" id="ussdNumero" name="numero" inputmode="numeric" autocomplete="tel"
                   placeholder="Ex : 07 07 07 07 07" maxlength="20" aria-describedby="opDetect">
            <div class="op-detect" id="opDetect" aria-live="polite">
                <span class="op-detect-idle">Opérateur détecté ici…</span>
            </div>
        </div>

        <div class="field">
            <label for="ussdAction">Action</label>
            <select id="ussdAction" name="action">
                <option value="achat_credit">Acheter du crédit</option>
                <option value="transfert_credit">Transférer du crédit</option>
                <option value="solde">Consulter mon solde</option>
                <option value="activation">Activer un forfait</option>
                <option value="mobile_money">Mobile Money</option>
            </select>
        </div>

        <div class="field" id="montantField">
            <label for="ussdMontant">Montant (FCFA)</label>
            <input type="number" id="ussdMontant" name="montant" min="<?= (int) $montant_min ?>"
                   max="<?= (int) $montant_max ?>" step="50" placeholder="Ex : 1000">
            <div class="field-hint">Entre <?= fcfa($montant_min) ?> et <?= fcfa($montant_max) ?>.</div>
        </div>

        <div class="field" id="codeField" hidden>
            <label for="ussdCode">Code / numéro destinataire</label>
            <input type="text" id="ussdCode" name="code" inputmode="numeric" placeholder="Selon l'action">
        </div>

        <button type="submit" class="btn btn-primary btn-lg btn-block" id="ussdSubmit">Générer le code</button>
        <p class="ussd-error" id="ussdError" role="alert" hidden></p>
    </form>

    <!-- Résultat -->
    <div class="ussd-result" id="ussdResult" hidden>
        <span class="ussd-result-op" id="ussdResultOp"></span>
        <h2 id="ussdResultLabel">Votre code</h2>
        <code class="code-big" id="ussdResultCode"></code>
        <div class="modal-actions">
            <a class="btn btn-primary btn-lg" id="ussdDial" href="#">📲 Composer</a>
            <button type="button" class="btn btn-outline btn-lg js-copy" id="ussdCopy" data-copy="">📋 Copier</button>
        </div>
        <p class="ussd-result-hint">Le bouton « Composer » ouvre votre clavier téléphonique avec le code déjà saisi. Appuyez sur appeler pour l'exécuter.</p>
    </div>
</section>

<!-- Tableau récap des codes par opérateur -->
<section class="section section-alt">
    <div class="container">
        <div class="section-head"><h2>Tous les codes par opérateur</h2></div>
        <div class="codes-grid">
            <?php foreach ($operateurs as $op): ?>
                <?php $liste = $patterns[$op['slug']] ?? []; ?>
                <div class="codes-op-card" style="--op-color: <?= e($op['couleur_hex']) ?>">
                    <h3><span class="op-dot" style="background: <?= e($op['couleur_hex']) ?>"></span><?= e($op['nom']) ?></h3>
                    <?php if ($liste === []): ?>
                        <p class="empty-sm">Aucun code enregistré.</p>
                    <?php else: ?>
                        <ul class="codes-list">
                            <?php foreach ($liste as $c): ?>
                                <li>
                                    <span class="code-label"><?= e($c['libelle']) ?></span>
                                    <code class="code-pattern"><?= e($c['pattern']) ?></code>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- Patterns exposés au JS pour un aperçu instantané (la génération finale
     reste validée côté serveur via /api/generer-code). -->
<script id="ussdPatterns" type="application/json">
    <?= json_encode($patterns, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>
</script>

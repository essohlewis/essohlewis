<?php
/**
 * Comparateur de forfaits (2 à 3 côte à côte).
 * Variables : $selection (préchargée), $forfaits (liste pour sélection),
 * $operateurs, $categories.
 */
/** @var array<int,array<string,mixed>> $selection */
/** @var array<int,array<string,mixed>> $forfaits */
?>
<section class="page-head">
    <div class="container">
        <h1>Comparateur de forfaits</h1>
        <p>Sélectionnez 2 à 3 forfaits pour les comparer côte à côte. Le meilleur rapport prix/Go est mis en évidence automatiquement.</p>
    </div>
</section>

<section class="container compare-wrap">
    <div class="compare-picker">
        <label for="comparePick">Ajouter un forfait</label>
        <select id="comparePick">
            <option value="">— Choisir un forfait —</option>
            <?php foreach ($forfaits as $f): ?>
                <option value="<?= (int) $f['id'] ?>"
                        data-nom="<?= e($f['nom']) ?>"
                        data-op="<?= e($f['operateur_nom']) ?>"
                        data-prix="<?= (int) $f['prix'] ?>">
                    <?= e($f['operateur_nom']) ?> — <?= e($f['nom']) ?> (<?= fcfa((int) $f['prix']) ?>)
                </option>
            <?php endforeach; ?>
        </select>
        <span class="compare-hint">3 forfaits maximum</span>
    </div>

    <div id="compareEmpty" class="compare-empty" <?= $selection !== [] ? 'hidden' : '' ?>>
        <p>⚖️ Aucun forfait sélectionné. Ajoutez-en depuis la liste ci-dessus ou depuis le
            <a href="<?= url('/forfaits') ?>">catalogue</a>.</p>
    </div>

    <div class="compare-table-scroll">
        <table class="compare-table" id="compareTable" <?= $selection === [] ? 'hidden' : '' ?>>
            <tbody>
                <!-- Le contenu est rendu/actualisé par app.js. -->
            </tbody>
        </table>
    </div>
</section>

<!-- Données initiales de sélection transmises au JS. -->
<script id="compareInitial" type="application/json">
    <?= json_encode(array_map(static fn ($f) => [
        'id' => (int) $f['id'],
        'nom' => $f['nom'],
        'operateur' => $f['operateur_nom'],
        'operateur_couleur' => $f['operateur_couleur'],
        'prix' => (int) $f['prix'],
        'volume_data' => $f['volume_data'],
        'minutes_appel' => $f['minutes_appel'],
        'sms' => $f['sms'],
        'validite' => $f['validite'],
        'code_ussd' => $f['code_ussd'],
        'prix_au_go' => $f['prix_au_go'] ?? null,
    ], $selection), JSON_UNESCAPED_UNICODE) ?>
</script>

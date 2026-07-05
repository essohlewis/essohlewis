<?php /** @var \Transouscris\Models\Favorite[] $favorites */ ?>
<div class="space-y-6">
    <div class="bg-white rounded-2xl shadow p-6">
        <h1 class="text-xl font-bold">Mes favoris</h1>
        <p class="text-sm text-slate-500 mt-1">Enregistrez vos numéros pour recharger en un clic.</p>

        <form id="fav-form" class="mt-5 grid sm:grid-cols-2 gap-3">
            <div>
                <label class="text-sm font-medium">Nom</label>
                <input name="label" placeholder="Ex : Maman" class="mt-1 w-full border rounded-lg px-3 py-2" required>
            </div>
            <div>
                <label class="text-sm font-medium">Relation</label>
                <select name="relation" class="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="moi">Moi-même</option>
                    <option value="famille">Famille</option>
                    <option value="parents">Parents</option>
                    <option value="conjoint">Conjoint(e)</option>
                    <option value="enfants">Enfants</option>
                    <option value="amis">Amis</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="autre">Autre</option>
                </select>
            </div>
            <div class="sm:col-span-2">
                <label class="text-sm font-medium">Numéro</label>
                <input name="phone" inputmode="tel" placeholder="07 00 00 00 00" class="mt-1 w-full border rounded-lg px-3 py-2" required>
            </div>
            <div class="sm:col-span-2">
                <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Ajouter aux favoris</button>
                <p id="fav-msg" class="text-sm text-center text-rose-600 mt-1"></p>
            </div>
        </form>
    </div>

    <div id="fav-list" class="grid sm:grid-cols-2 gap-3">
        <?php if (!$favorites): ?>
            <p class="text-sm text-slate-500">Aucun favori pour l'instant.</p>
        <?php else: foreach ($favorites as $f): ?>
            <div class="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between" data-fav="<?= (int) $f->id ?>">
                <div class="flex items-center gap-3">
                    <span class="text-2xl"><?= $f->relationIcon() ?></span>
                    <div>
                        <div class="font-semibold"><?= e($f->label) ?></div>
                        <div class="text-xs text-slate-500"><?= e($f->msisdn) ?><?= $f->operatorCode ? ' · ' . e(strtoupper($f->operatorCode)) : '' ?></div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <?php if ($f->operatorCode): ?>
                        <a href="/recharge?operator=<?= e($f->operatorCode) ?>&type=credit&phone=<?= e($f->msisdn) ?>"
                           class="text-xs bg-teal-700 text-white rounded px-2 py-1">Recharger</a>
                    <?php endif; ?>
                    <button class="fav-del text-xs text-rose-600 border border-rose-200 rounded px-2 py-1">Suppr.</button>
                </div>
            </div>
        <?php endforeach; endif; ?>
    </div>
</div>

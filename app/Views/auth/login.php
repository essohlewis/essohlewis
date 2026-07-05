<div class="max-w-sm mx-auto bg-white rounded-2xl shadow p-6 mt-6">
    <h1 class="text-xl font-bold text-slate-900">Connexion / Inscription</h1>
    <p class="text-sm text-slate-500 mt-1">Entrez votre numéro pour recevoir un code par SMS.</p>

    <form id="otp-request" class="mt-6 space-y-4">
        <div>
            <label class="text-sm font-medium">Numéro de téléphone</label>
            <input name="phone" inputmode="tel" placeholder="07 00 00 00 00"
                   class="mt-1 w-full border rounded-lg px-3 py-2" required>
        </div>
        <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Recevoir le code</button>
    </form>

    <form id="otp-verify" class="mt-6 space-y-4 hidden">
        <div>
            <label class="text-sm font-medium">Votre nom (optionnel)</label>
            <input name="name" class="mt-1 w-full border rounded-lg px-3 py-2">
        </div>
        <div>
            <label class="text-sm font-medium">Code reçu par SMS</label>
            <input name="code" inputmode="numeric" maxlength="6" placeholder="______"
                   class="mt-1 w-full border rounded-lg px-3 py-2 tracking-[0.5em] text-center" required>
        </div>
        <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Se connecter</button>
    </form>

    <p id="otp-msg" class="text-sm mt-4 text-center text-rose-600"></p>
</div>

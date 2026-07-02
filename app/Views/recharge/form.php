<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6">
    <h1 class="text-xl font-bold">Nouvelle recharge</h1>

    <form id="recharge-form" class="mt-6 space-y-4">
        <div>
            <label class="text-sm font-medium">Numéro à recharger</label>
            <input name="phone" id="rc-phone" inputmode="tel" placeholder="07 00 00 00 00"
                   class="mt-1 w-full border rounded-lg px-3 py-2" required>
            <div id="rc-operator" class="text-sm mt-1 text-slate-500"></div>
            <input type="hidden" name="operator" id="rc-operator-code">
        </div>

        <div>
            <label class="text-sm font-medium">Type</label>
            <select name="type" id="rc-type" class="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="credit">Crédit</option>
                <option value="internet">Forfait internet</option>
                <option value="voice">Forfait appel</option>
                <option value="sms">Forfait SMS</option>
            </select>
        </div>

        <div id="rc-amount-wrap">
            <label class="text-sm font-medium">Montant (F CFA)</label>
            <input name="amount" id="rc-amount" inputmode="numeric" placeholder="1000"
                   class="mt-1 w-full border rounded-lg px-3 py-2">
        </div>

        <div id="rc-plans-wrap" class="hidden">
            <label class="text-sm font-medium">Forfait</label>
            <select name="plan_id" id="rc-plans" class="mt-1 w-full border rounded-lg px-3 py-2"></select>
        </div>

        <button class="w-full bg-teal-700 text-white rounded-lg py-2 font-semibold">Payer depuis mon portefeuille</button>
        <p id="rc-msg" class="text-sm text-center text-rose-600"></p>
    </form>
</div>

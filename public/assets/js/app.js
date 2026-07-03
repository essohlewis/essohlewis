/**
 * Transouscris — logique front (Vanilla JS).
 * - Enregistrement du Service Worker (PWA).
 * - Helpers fetch avec jeton CSRF.
 * - Flux OTP, recharge (avec file d'attente hors-ligne), portefeuille, cagnotte.
 */
(function () {
    'use strict';

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

    async function api(url, body, method = 'POST') {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf(),
                'Accept': 'application/json',
            },
            body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    // ── Service Worker ────────────────────────────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').catch(() => {});
        });
    }

    // ── File d'attente hors-ligne (mode dégradé) ──────────────
    const QUEUE_KEY = 'transouscris_offline_queue';
    const queue = {
        all: () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'),
        save: (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q)),
        push(item) { const q = this.all(); q.push(item); this.save(q); },
        async flush() {
            const q = this.all();
            if (!q.length) return;
            const remaining = [];
            for (const item of q) {
                try {
                    const { ok } = await api(item.url, item.body);
                    if (!ok) remaining.push(item);
                } catch (_) { remaining.push(item); }
            }
            this.save(remaining);
            if (q.length && remaining.length < q.length) {
                notify('Demandes hors-ligne synchronisées ✔');
            }
        },
    };
    window.addEventListener('online', () => queue.flush());
    if (navigator.onLine) queue.flush();

    function notify(msg) {
        const el = document.createElement('div');
        el.textContent = msg;
        el.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow z-50';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    function setMsg(id, text, ok = false) {
        const el = document.getElementById(id);
        if (el) { el.textContent = text; el.className = 'text-sm text-center ' + (ok ? 'text-emerald-600' : 'text-rose-600'); }
    }

    // ── Authentification OTP ──────────────────────────────────
    const otpReq = document.getElementById('otp-request');
    if (otpReq) {
        otpReq.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = otpReq.phone.value.trim();
            const { ok, data } = await api('/auth/otp/request', { phone });
            if (ok) {
                const verify = document.getElementById('otp-verify');
                verify.classList.remove('hidden');
                otpReq.classList.add('hidden');
                verify.dataset.phone = phone;
                if (data.dev_code) {
                    // Mode développement : pré-remplit le code et l'affiche.
                    verify.code.value = data.dev_code;
                    setMsg('otp-msg', 'Mode dev — code : ' + data.dev_code + ' (aucun SMS envoyé)', true);
                } else {
                    setMsg('otp-msg', data.message || 'Code envoyé par SMS.', true);
                }
            } else {
                setMsg('otp-msg', data.error || 'Erreur.');
            }
        });
    }
    const otpVer = document.getElementById('otp-verify');
    if (otpVer) {
        otpVer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { ok, data } = await api('/auth/otp/verify', {
                phone: otpVer.dataset.phone,
                code: otpVer.code.value.trim(),
                name: otpVer.name.value.trim(),
            });
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('otp-msg', data.error || 'Code invalide.'); }
        });
    }

    // ── Assistant tableau de bord : réseau → type → Suivant ───
    const wizard = document.getElementById('op-wizard');
    if (wizard) {
        const state = { operator: null, type: null };
        const step2 = document.getElementById('op-step-2');
        const step3 = document.getElementById('op-step-3');
        const forfait = document.getElementById('op-forfait');
        const nextBtn = document.getElementById('op-next');

        function select(group, chosen, color) {
            wizard.querySelectorAll(group).forEach((n) => {
                n.classList.remove('ring-2', 'ring-teal-200');
                n.style.borderColor = '';
            });
            chosen.classList.add('ring-2', 'ring-teal-200');
            chosen.style.borderColor = color || '#0f766e';
        }

        function refreshNext() {
            if (state.operator && state.type) {
                step3.classList.remove('hidden');
                nextBtn.href = '/recharge?operator=' + state.operator + '&type=' + state.type;
            } else {
                step3.classList.add('hidden');
            }
        }

        wizard.querySelectorAll('.op-net').forEach((btn) => btn.addEventListener('click', () => {
            state.operator = btn.dataset.op;
            select('.op-net', btn, btn.dataset.color);
            step2.classList.remove('hidden');
            refreshNext();
        }));

        wizard.querySelectorAll('.op-type').forEach((btn) => btn.addEventListener('click', () => {
            select('.op-type', btn);
            if (btn.dataset.type === 'forfait') {
                state.type = null; // attend le choix du sous-type de forfait
                forfait.classList.remove('hidden');
            } else {
                state.type = btn.dataset.type; // credit ou transfer
                forfait.classList.add('hidden');
            }
            refreshNext();
        }));

        wizard.querySelectorAll('.op-sub').forEach((btn) => btn.addEventListener('click', () => {
            state.type = btn.dataset.type;
            select('.op-sub', btn);
            refreshNext();
        }));
    }

    // ── Recharge : parcours guidé (réseau → type → numéro → montant/forfait → confirmation)
    const flow = document.getElementById('recharge-flow');
    if (flow) {
        const SUBCATS = {
            illimite: 'Illimité', jour: 'Pass jour', semaine: 'Pass semaine',
            quinzaine: 'Pass 10-15 j', mois: 'Pass mois', nuit: 'Pass nuit', special: 'Offres spéciales',
        };
        const state = {
            operator: flow.dataset.operator || null,
            type: flow.dataset.type || null,   // credit | internet | voice | sms
            phone: '', amount: null, planId: null, planLabel: '',
        };
        let allPlans = [];       // forfaits chargés pour l'opérateur courant
        let subFilter = 'all';
        const history = [];       // pile des étapes pour le bouton Retour

        const steps = {};
        flow.querySelectorAll('.rc-step').forEach((s) => { steps[s.dataset.step] = s; });
        const errNodes = flow.querySelectorAll('.rc-err');

        function ring(nodes, chosen, color) {
            nodes.forEach((n) => { n.classList.remove('ring-2', 'ring-teal-200'); n.style.borderColor = ''; });
            if (chosen) { chosen.classList.add('ring-2', 'ring-teal-200'); chosen.style.borderColor = color || '#0f766e'; }
        }
        function clearErrors() { errNodes.forEach((n) => (n.textContent = '')); }
        function show(step, push = true) {
            clearErrors();
            Object.values(steps).forEach((s) => s.classList.add('hidden'));
            steps[step].classList.remove('hidden');
            if (push) history.push(step);
        }
        function back() {
            history.pop();
            const prev = history[history.length - 1] || 'type';
            show(prev, false);
        }

        // ---- Réseau (sélecteur d'en-tête, modifiable à tout moment) ----
        const netBtns = flow.querySelectorAll('.rc-net');
        function highlightNet() {
            netBtns.forEach((b) => {
                const on = b.dataset.op === state.operator;
                b.classList.toggle('ring-2', on); b.classList.toggle('ring-teal-200', on);
                b.style.borderColor = on ? (b.dataset.color || '#0f766e') : '';
            });
        }
        netBtns.forEach((b) => b.addEventListener('click', () => {
            state.operator = b.dataset.op; highlightNet();
            allPlans = []; // forcera un rechargement des forfaits
        }));
        highlightNet();

        // ---- Étape TYPE ----
        const forfaitSub = document.getElementById('rc-forfait-sub');
        const typeNext = steps.type.querySelector('.rc-next');
        function refreshTypeNext() { typeNext.classList.toggle('hidden', !state.type); }

        steps.type.querySelectorAll('.rc-type').forEach((btn) => btn.addEventListener('click', () => {
            ring(steps.type.querySelectorAll('.rc-type'), btn);
            if (btn.dataset.type === 'forfait') {
                state.type = null; forfaitSub.classList.remove('hidden');
                ring(steps.type.querySelectorAll('.rc-cat'), null);
            } else {
                // credit ou transfer : opération à montant direct
                state.type = btn.dataset.type; forfaitSub.classList.add('hidden');
            }
            refreshTypeNext();
        }));
        steps.type.querySelectorAll('.rc-cat').forEach((btn) => btn.addEventListener('click', () => {
            state.type = btn.dataset.type; ring(steps.type.querySelectorAll('.rc-cat'), btn); refreshTypeNext();
        }));
        typeNext.addEventListener('click', () => {
            if (!state.operator) { alert('Choisissez d\'abord un réseau (en haut).'); return; }
            // Règle métier : le transfert vers son propre numéro est interdit.
            if (meBtn) meBtn.style.display = state.type === 'transfer' ? 'none' : '';
            show('number');
            phoneInput.focus();
        });

        // ---- Étape NUMÉRO ----
        const phoneInput = document.getElementById('rc-phone');
        const opHint = document.getElementById('rc-op-hint');
        const meBtn = document.getElementById('rc-me');
        let detectTimer;

        function checkNumber() {
            clearTimeout(detectTimer);
            detectTimer = setTimeout(async () => {
                if (!phoneInput.value.trim()) { opHint.textContent = ''; return; }
                const { data } = await api('/recharge/detect', { phone: phoneInput.value });
                if (data.detected && data.operator !== state.operator) {
                    opHint.innerHTML = '⚠️ Ce numéro semble être <b>' + data.operator.toUpperCase() +
                        '</b>. Réseau choisi : <b>' + (state.operator || '').toUpperCase() + '</b>.';
                    opHint.className = 'text-sm mt-2 text-amber-600';
                } else if (data.detected) {
                    opHint.textContent = '✓ Numéro ' + data.operator.toUpperCase();
                    opHint.className = 'text-sm mt-2 text-emerald-600';
                } else { opHint.textContent = ''; }
            }, 300);
        }
        phoneInput.addEventListener('input', checkNumber);
        if (meBtn) meBtn.addEventListener('click', () => { phoneInput.value = flow.dataset.my; checkNumber(); });
        flow.querySelectorAll('.rc-recent').forEach((c) => c.addEventListener('click', () => {
            phoneInput.value = c.dataset.num; checkNumber();
        }));
        steps.number.querySelector('.rc-next').addEventListener('click', async () => {
            const { data } = await api('/recharge/detect', { phone: phoneInput.value });
            if (!data.msisdn) { steps.number.querySelector('.rc-err').textContent = 'Numéro invalide.'; return; }
            state.phone = phoneInput.value.trim();
            state.msisdn = data.msisdn;
            if (state.type === 'credit' || state.type === 'transfer') { show('amount'); }
            else { await openPlans(); show('plans'); }
        });

        // ---- Étape MONTANT (crédit) ----
        const customAmount = document.getElementById('rc-amount-custom');
        steps.amount.querySelectorAll('.rc-amount').forEach((btn) => btn.addEventListener('click', () => {
            state.amount = parseInt(btn.dataset.amount, 10);
            ring(steps.amount.querySelectorAll('.rc-amount'), btn);
            customAmount.value = '';
        }));
        customAmount.addEventListener('input', () => {
            state.amount = parseInt(customAmount.value, 10) || null;
            ring(steps.amount.querySelectorAll('.rc-amount'), null);
        });
        steps.amount.querySelector('.rc-next').addEventListener('click', () => {
            if (!state.amount || state.amount < 100) { steps.amount.querySelector('.rc-err').textContent = 'Montant minimum : 100 F.'; return; }
            buildSummary(); show('confirm');
        });

        // ---- Étape FORFAITS ----
        const subcatsEl = document.getElementById('rc-subcats');
        const planListEl = document.getElementById('rc-plan-list');
        const plansEmpty = document.getElementById('rc-plans-empty');

        async function openPlans() {
            if (!allPlans.length || allPlans._op !== state.operator) {
                const { data } = await api('/recharge/plans/' + state.operator, null, 'GET');
                allPlans = data.plans || []; allPlans._op = state.operator;
            }
            subFilter = 'all';
            renderSubcats(); renderPlans();
        }
        function categoryPlans() { return allPlans.filter((p) => p.category === state.type); }
        function renderSubcats() {
            const subs = [...new Set(categoryPlans().map((p) => p.subcategory).filter(Boolean))];
            const chips = ['<button type="button" class="rc-sub text-xs rounded-full px-3 py-1 border-2 border-teal-600 bg-teal-50" data-sub="all">Tout</button>'];
            subs.forEach((s) => chips.push('<button type="button" class="rc-sub text-xs rounded-full px-3 py-1 border-2 border-slate-200" data-sub="' + s + '">' + (SUBCATS[s] || s) + '</button>'));
            subcatsEl.innerHTML = subs.length ? chips.join('') : '';
            subcatsEl.querySelectorAll('.rc-sub').forEach((b) => b.addEventListener('click', () => {
                subFilter = b.dataset.sub;
                subcatsEl.querySelectorAll('.rc-sub').forEach((x) => { x.classList.remove('border-teal-600', 'bg-teal-50'); x.classList.add('border-slate-200'); });
                b.classList.add('border-teal-600', 'bg-teal-50'); b.classList.remove('border-slate-200');
                renderPlans();
            }));
        }
        function renderPlans() {
            const list = categoryPlans().filter((p) => subFilter === 'all' || p.subcategory === subFilter);
            plansEmpty.classList.toggle('hidden', list.length > 0);
            planListEl.innerHTML = list.map((p) => `
                <button type="button" class="rc-plan w-full text-left rounded-xl border-2 border-slate-200 p-3 hover:border-teal-400" data-id="${p.id}">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="font-semibold">${p.name}</div>
                            <div class="text-xs text-slate-500">${p.data_volume ? p.data_volume + ' · ' : ''}${p.validity || ''}${p.description ? ' · ' + p.description : ''}</div>
                        </div>
                        <div class="font-bold text-teal-700 whitespace-nowrap ml-2">${p.price.toLocaleString('fr-FR')} F</div>
                    </div>
                </button>`).join('');
            planListEl.querySelectorAll('.rc-plan').forEach((b) => b.addEventListener('click', () => {
                const plan = list.find((p) => String(p.id) === b.dataset.id);
                state.planId = plan.id; state.amount = plan.price; state.planLabel = plan.name;
                buildSummary(); show('confirm');
            }));
        }

        // ---- Étape CONFIRMATION ----
        function row(k, v) { return '<div class="flex justify-between p-3"><dt class="text-slate-500">' + k + '</dt><dd class="font-medium">' + v + '</dd></div>'; }
        function buildSummary() {
            const typeLabel = state.type === 'credit' ? 'Crédit (recharge)'
                : state.type === 'transfer' ? 'Transfert de crédit'
                : (state.planLabel || state.type);
            document.getElementById('rc-summary').innerHTML =
                row('Réseau', (state.operator || '').toUpperCase()) +
                row('Numéro', state.phone) +
                row('Opération', typeLabel) +
                row('Montant', state.amount.toLocaleString('fr-FR') + ' F CFA');
        }
        document.getElementById('rc-submit').addEventListener('click', async () => {
            const isDirect = state.type === 'credit' || state.type === 'transfer';
            const body = {
                phone: state.phone, operator: state.operator, type: state.type,
                amount: isDirect ? state.amount : null,
                plan_id: isDirect ? null : state.planId,
            };
            if (!navigator.onLine) {
                queue.push({ url: '/recharge', body });
                notify('Hors-ligne : recharge mise en file, envoi à la reconnexion.');
                return;
            }
            const { ok, data } = await api('/recharge', body);
            if (ok && data.redirect) { window.location = data.redirect; }
            else { steps.confirm.querySelector('.rc-err').textContent = data.error || 'Recharge impossible.'; }
        });

        // ---- Navigation Retour ----
        flow.querySelectorAll('.rc-back').forEach((b) => b.addEventListener('click', back));

        // ---- Amorçage : applique la pré-sélection (tableau de bord, historique, favoris) ----
        if (flow.dataset.phone) { phoneInput.value = flow.dataset.phone; }
        if (parseInt(flow.dataset.amount, 10) > 0) { state.amount = parseInt(flow.dataset.amount, 10); }
        show('type');
        if (state.type === 'credit' || state.type === 'transfer') {
            ring(steps.type.querySelectorAll('.rc-type'), [...steps.type.querySelectorAll('.rc-type')].find((x) => x.dataset.type === state.type));
            refreshTypeNext();
        } else if (state.type) {
            const forfaitBtn = [...steps.type.querySelectorAll('.rc-type')].find((x) => x.dataset.type === 'forfait');
            ring(steps.type.querySelectorAll('.rc-type'), forfaitBtn);
            forfaitSub.classList.remove('hidden');
            ring(steps.type.querySelectorAll('.rc-cat'), [...steps.type.querySelectorAll('.rc-cat')].find((x) => x.dataset.type === state.type));
            refreshTypeNext();
        }
    }

    // ── Approvisionnement portefeuille ────────────────────────
    const topup = document.getElementById('topup-form');
    if (topup) {
        topup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { ok, data } = await api('/wallet/topup', {
                amount: topup.amount.value, gateway: topup.gateway.value,
            });
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('topup-msg', data.error || 'Erreur.'); }
        });
    }

    // ── Contribution cagnotte ─────────────────────────────────
    const pot = document.getElementById('pot-contribute');
    if (pot) {
        pot.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { ok, data } = await api('/cagnotte/' + pot.dataset.slug + '/contribuer', {
                name: pot.name.value, phone: pot.phone.value, amount: pot.amount.value, gateway: pot.gateway.value,
            });
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('pot-msg', data.error || 'Contribution impossible.'); }
        });
    }

    // ── Recharges programmées ─────────────────────────────────
    const sched = document.getElementById('sched-form');
    if (sched) {
        sched.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { ok, data } = await api('/programmees', {
                phone: sched.phone.value.trim(),
                operator: sched.operator.value,
                amount: sched.amount.value,
                frequency: sched.frequency.value,
            });
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('sched-msg', data.error || 'Création impossible.'); }
        });
    }
    const schedList = document.getElementById('sched-list');
    if (schedList) {
        schedList.addEventListener('click', async (e) => {
            const row = e.target.closest('[data-sched]');
            if (!row) return;
            const id = row.dataset.sched;

            if (e.target.classList.contains('sched-run')) {
                const { ok, data } = await api('/programmees/' + id + '/executer', {});
                notify(ok ? (data.message || 'Recharge exécutée ✔') : (data.error || 'Échec.'));
            } else if (e.target.classList.contains('sched-toggle')) {
                const { ok } = await api('/programmees/' + id + '/toggle', {});
                if (ok) window.location.reload();
            } else if (e.target.classList.contains('sched-del')) {
                if (!confirm('Supprimer cette programmation ?')) return;
                const { ok } = await api('/programmees/' + id, {}, 'DELETE');
                if (ok) row.remove();
            }
        });
    }

    // ── Favoris ───────────────────────────────────────────────
    const favForm = document.getElementById('fav-form');
    if (favForm) {
        favForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { ok, data } = await api('/favoris', {
                label: favForm.label.value.trim(),
                relation: favForm.relation.value,
                phone: favForm.phone.value.trim(),
            });
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('fav-msg', data.error || 'Ajout impossible.'); }
        });
    }
    const favList = document.getElementById('fav-list');
    if (favList) {
        favList.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('fav-del')) return;
            const card = e.target.closest('[data-fav]');
            if (!confirm('Supprimer ce favori ?')) return;
            const { ok } = await api('/favoris/' + card.dataset.fav, {}, 'DELETE');
            if (ok) card.remove();
        });
    }

    // ── Historique : recherche par numéro ─────────────────────
    const histSearch = document.getElementById('hist-search');
    if (histSearch) {
        histSearch.addEventListener('input', () => {
            const q = histSearch.value.trim();
            document.querySelectorAll('#hist-rows tr[data-num]').forEach((tr) => {
                tr.style.display = tr.dataset.num.includes(q) ? '' : 'none';
            });
        });
    }

    // ── Comparateur : recherche + filtres ─────────────────────
    const cmpSearch = document.getElementById('cmp-search');
    if (cmpSearch) {
        const cmpOp = document.getElementById('cmp-op');
        const cmpMax = document.getElementById('cmp-max');
        function filterCmp() {
            const q = cmpSearch.value.trim().toLowerCase();
            const op = cmpOp.value;
            const max = parseInt(cmpMax.value, 10) || Infinity;
            document.querySelectorAll('#cmp-rows tr').forEach((tr) => {
                const okText = !q || (tr.dataset.text || '').includes(q);
                const okOp = !op || tr.dataset.op === op;
                const okPrice = parseInt(tr.dataset.price, 10) <= max;
                tr.style.display = (okText && okOp && okPrice) ? '' : 'none';
            });
        }
        [cmpSearch, cmpOp, cmpMax].forEach((el) => el.addEventListener('input', filterCmp));
    }

    // ── Bascule mode sombre ───────────────────────────────────
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const dark = document.documentElement.classList.toggle('dark');
            try { localStorage.setItem('transouscris_theme', dark ? 'dark' : 'light'); } catch (_) {}
        });
    }
})();

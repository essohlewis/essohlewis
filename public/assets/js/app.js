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

    // ── Recharge : détection opérateur + forfaits + soumission ─
    const rc = document.getElementById('recharge-form');
    if (rc) {
        const opLabel = document.getElementById('rc-operator');
        const opCode = document.getElementById('rc-operator-code');
        let detectTimer;

        rc.querySelector('#rc-phone').addEventListener('input', (e) => {
            clearTimeout(detectTimer);
            detectTimer = setTimeout(async () => {
                const { data } = await api('/recharge/detect', { phone: e.target.value });
                if (data.detected) {
                    opCode.value = data.operator;
                    opLabel.textContent = 'Opérateur : ' + data.operator.toUpperCase() +
                        (data.authoritative ? '' : ' (à confirmer)');
                } else { opLabel.textContent = ''; opCode.value = ''; }
            }, 350);
        });

        const typeSel = document.getElementById('rc-type');
        const plansWrap = document.getElementById('rc-plans-wrap');
        const amountWrap = document.getElementById('rc-amount-wrap');
        const plansSel = document.getElementById('rc-plans');

        typeSel.addEventListener('change', async () => {
            if (typeSel.value === 'credit' || !opCode.value) {
                plansWrap.classList.add('hidden'); amountWrap.classList.remove('hidden'); plansSel.innerHTML = '';
                return;
            }
            const { data } = await api('/recharge/plans/' + opCode.value, null, 'GET');
            const plans = (data.plans || []).filter((p) => p.category === typeSel.value);
            if (plans.length) {
                plansSel.innerHTML = plans.map((p) =>
                    `<option value="${p.id}">${p.name} — ${p.price} F (${p.validity || ''})</option>`).join('');
                plansWrap.classList.remove('hidden'); amountWrap.classList.add('hidden');
            } else {
                plansWrap.classList.add('hidden'); amountWrap.classList.remove('hidden');
            }
        });

        rc.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                phone: rc.phone.value.trim(),
                operator: opCode.value,
                type: typeSel.value,
                amount: rc.amount ? rc.amount.value : null,
                plan_id: plansWrap.classList.contains('hidden') ? null : plansSel.value,
            };
            if (!navigator.onLine) {
                queue.push({ url: '/recharge', body });
                notify('Hors-ligne : recharge mise en file, envoi à la reconnexion.');
                return;
            }
            const { ok, data } = await api('/recharge', body);
            if (ok && data.redirect) { window.location = data.redirect; }
            else { setMsg('rc-msg', data.error || 'Recharge impossible.'); }
        });
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
})();

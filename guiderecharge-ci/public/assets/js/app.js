/* =====================================================================
   GuideRecharge CI — Logique front (JavaScript vanilla, ES6+)
   Détection opérateur, filtres, comparateur, générateur USSD, copie/appel.
   ===================================================================== */
(function () {
    'use strict';

    // Métadonnées globales.
    const BASE_URL = document.querySelector('meta[name="base-url"]')?.content || '';
    const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const url = (p) => BASE_URL + p;

    /* ------------------------------------------------------------------ */
    /* Utilitaires                                                        */
    /* ------------------------------------------------------------------ */

    /** Détection de l'opérateur par préfixe (miroir de operator_detect.php). */
    function detectOperateur(numero) {
        let digits = (numero || '').replace(/\D+/g, '');
        if (digits.startsWith('00225')) digits = digits.slice(5);
        else if (digits.startsWith('225')) digits = digits.slice(3);
        if (digits.length !== 10) return null;
        const p = digits.slice(0, 2);
        if (p === '07') return { slug: 'orange', nom: 'Orange', couleur: '#FF6600' };
        if (p === '05') return { slug: 'mtn', nom: 'MTN', couleur: '#FFCC00' };
        if (p === '01') return { slug: 'moov', nom: 'Moov', couleur: '#0066CC' };
        return null;
    }

    function normaliseNumero(numero) {
        let digits = (numero || '').replace(/\D+/g, '');
        if (digits.startsWith('00225')) digits = digits.slice(5);
        else if (digits.startsWith('225')) digits = digits.slice(3);
        return digits;
    }

    function fcfa(n) {
        return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
    }

    /** Affiche un toast éphémère. */
    function toast(message, type) {
        const box = document.getElementById('toastContainer');
        if (!box) return;
        const el = document.createElement('div');
        el.className = 'toast' + (type ? ' toast-' + type : '');
        el.textContent = message;
        box.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 2600);
    }

    /** Copie un texte dans le presse-papiers avec repli. */
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Repli pour les contextes non sécurisés.
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
            ta.remove();
            return ok;
        }
    }

    /** Construit un lien tel: en encodant le # en %23. */
    function telLink(code) {
        return 'tel:' + code.replace(/#/g, '%23');
    }

    /* ------------------------------------------------------------------ */
    /* Thème clair/sombre                                                 */
    /* ------------------------------------------------------------------ */
    (function themeInit() {
        const root = document.documentElement;
        const saved = localStorage.getItem('grc-theme');
        if (saved) root.setAttribute('data-theme', saved);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            root.setAttribute('data-theme', 'dark');
        }
        document.addEventListener('click', (e) => {
            if (e.target.closest('#themeToggle')) {
                const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                root.setAttribute('data-theme', next);
                localStorage.setItem('grc-theme', next);
            }
        });
    })();

    /* ------------------------------------------------------------------ */
    /* Navigation mobile                                                  */
    /* ------------------------------------------------------------------ */
    (function navInit() {
        const toggle = document.getElementById('navToggle');
        const nav = document.getElementById('siteNav');
        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                const open = nav.classList.toggle('open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }
        // Admin sidebar.
        const adminToggle = document.getElementById('adminMenuToggle');
        const sidebar = document.getElementById('adminSidebar');
        if (adminToggle && sidebar) {
            adminToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
    })();

    /* ------------------------------------------------------------------ */
    /* Copie & confirmation (délégation globale)                          */
    /* ------------------------------------------------------------------ */
    document.addEventListener('click', async (e) => {
        // Boutons « Copier ».
        const copyBtn = e.target.closest('.js-copy');
        if (copyBtn) {
            const text = copyBtn.getAttribute('data-copy');
            if (text) {
                const ok = await copyText(text);
                toast(ok ? 'Code copié ✓' : 'Copie impossible', ok ? 'ok' : 'err');
            }
        }

        // Modale « Voir le code ».
        const voir = e.target.closest('.js-voir-code');
        if (voir) {
            openCodeModal(voir.getAttribute('data-code'), voir.getAttribute('data-nom'));
        }
    });

    // Confirmation avant suppression (formulaires admin).
    document.addEventListener('submit', (e) => {
        const form = e.target.closest('.js-confirm');
        if (form) {
            const msg = form.getAttribute('data-confirm') || 'Confirmer cette action ?';
            if (!window.confirm(msg)) e.preventDefault();
        }
    });

    /* ------------------------------------------------------------------ */
    /* Modale code (catalogue)                                            */
    /* ------------------------------------------------------------------ */
    function openCodeModal(code, nom) {
        const modal = document.getElementById('codeModal');
        if (!modal || !code) return;
        document.getElementById('codeModalNom').textContent = nom || '';
        document.getElementById('codeModalCode').textContent = code;
        const copy = document.getElementById('codeModalCopy');
        copy.setAttribute('data-copy', code);
        document.getElementById('codeModalDial').setAttribute('href', telLink(code));
        modal.hidden = false;
    }
    (function modalInit() {
        const modal = document.getElementById('codeModal');
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('#codeModalClose')) modal.hidden = true;
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') modal.hidden = true;
        });
    })();

    /* ------------------------------------------------------------------ */
    /* Filtres du catalogue (fetch, sans rechargement)                    */
    /* ------------------------------------------------------------------ */
    (function filtersInit() {
        const form = document.getElementById('filters');
        const grid = document.getElementById('forfaitsGrid');
        if (!form || !grid) return;

        const countEl = document.getElementById('resultCount');
        let timer = null;

        function buildQuery() {
            const params = new URLSearchParams();
            new FormData(form).forEach((v, k) => { if (v !== '') params.append(k, v); });
            return params.toString();
        }

        async function apply() {
            const qs = buildQuery();
            // Met à jour l'URL sans recharger (partage/retour possible).
            history.replaceState(null, '', url('/forfaits') + (qs ? '?' + qs : ''));
            try {
                const res = await fetch(url('/api/forfaits') + '?' + qs, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const data = await res.json();
                renderForfaits(grid, data.forfaits);
                if (countEl) countEl.textContent = data.count;
                bindCompareChecks();
            } catch (err) {
                toast('Erreur de chargement', 'err');
            }
        }

        form.addEventListener('change', apply);
        form.addEventListener('input', (e) => {
            if (e.target.type === 'number') {
                clearTimeout(timer);
                timer = setTimeout(apply, 400);
            }
        });

        const reset = document.getElementById('resetFilters');
        if (reset) reset.addEventListener('click', () => { form.reset(); apply(); });
    })();

    /** Rend une liste de cartes forfait dans une grille. */
    function renderForfaits(grid, forfaits) {
        if (!forfaits || forfaits.length === 0) {
            grid.innerHTML = '<p class="empty">Aucun forfait ne correspond à ces critères.</p>';
            return;
        }
        grid.innerHTML = forfaits.map(cardHtml).join('');
    }

    /** Génère le HTML d'une carte forfait (échappement basique). */
    function cardHtml(f) {
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const specs = [];
        if (f.volume_data) specs.push(`<span class="spec"><span class="spec-ico">🌐</span>${esc(f.volume_data)}</span>`);
        if (f.minutes_appel) specs.push(`<span class="spec"><span class="spec-ico">📞</span>${esc(f.minutes_appel)}</span>`);
        if (f.sms) specs.push(`<span class="spec"><span class="spec-ico">✉️</span>${esc(f.sms)}</span>`);
        if (f.validite) specs.push(`<span class="spec"><span class="spec-ico">⏳</span>${esc(f.validite)}</span>`);

        const actions = f.code_ussd
            ? `<button type="button" class="btn btn-outline btn-sm js-voir-code" data-code="${esc(f.code_ussd)}" data-nom="${esc(f.nom)}">Voir le code</button>
               <a class="btn btn-primary btn-sm" href="${telLink(esc(f.code_ussd))}">📲 Composer</a>`
            : `<a class="btn btn-outline btn-sm" href="${url('/forfait/' + f.id)}">Détails</a>`;

        return `<article class="forfait-card" data-operateur="${esc(f.operateur_slug)}" data-prix="${f.prix}" style="--op-color:${esc(f.operateur_couleur)}">
            <header class="forfait-card-head">
                <span class="op-badge" style="background:${esc(f.operateur_couleur)}">${esc(f.operateur_nom)}</span>
                ${f.populaire ? '<span class="badge-pop">★ Populaire</span>' : ''}
            </header>
            <h3 class="forfait-nom">${esc(f.nom)}</h3>
            <span class="forfait-cat">${esc(f.categorie_nom || '')}</span>
            <div class="forfait-specs">${specs.join('')}</div>
            <div class="forfait-prix">${fcfa(f.prix)}</div>
            <div class="forfait-actions">${actions}</div>
            <label class="compare-check"><input type="checkbox" class="js-compare-toggle" value="${f.id}" data-nom="${esc(f.nom)}"> Comparer</label>
        </article>`;
    }

    /* ------------------------------------------------------------------ */
    /* Sélection pour le comparateur (depuis le catalogue)                */
    /* ------------------------------------------------------------------ */
    function getCompareSelection() {
        try { return JSON.parse(sessionStorage.getItem('grc-compare') || '[]'); }
        catch (e) { return []; }
    }
    function setCompareSelection(ids) {
        sessionStorage.setItem('grc-compare', JSON.stringify(ids.slice(0, 3)));
    }

    function bindCompareChecks() {
        const tray = document.getElementById('compareTray');
        const countEl = document.getElementById('compareCount');
        const goBtn = document.getElementById('compareGo');
        const selection = getCompareSelection();

        document.querySelectorAll('.js-compare-toggle').forEach((cb) => {
            cb.checked = selection.includes(parseInt(cb.value, 10));
            cb.onchange = () => {
                let ids = getCompareSelection();
                const id = parseInt(cb.value, 10);
                if (cb.checked) {
                    if (ids.length >= 3) {
                        cb.checked = false;
                        toast('3 forfaits maximum', 'err');
                        return;
                    }
                    if (!ids.includes(id)) ids.push(id);
                } else {
                    ids = ids.filter((x) => x !== id);
                }
                setCompareSelection(ids);
                updateTray();
            };
        });

        function updateTray() {
            const ids = getCompareSelection();
            if (countEl) countEl.textContent = ids.length;
            if (tray) tray.hidden = ids.length === 0;
            if (goBtn) goBtn.setAttribute('href', url('/comparer') + '?ids=' + ids.join(','));
        }
        updateTray();
    }
    bindCompareChecks();

    /* ------------------------------------------------------------------ */
    /* Comparateur (page dédiée)                                          */
    /* ------------------------------------------------------------------ */
    (function compareInit() {
        const table = document.getElementById('compareTable');
        const pick = document.getElementById('comparePick');
        if (!table || !pick) return;

        const emptyEl = document.getElementById('compareEmpty');
        let items = [];

        // Charge la sélection initiale rendue côté serveur.
        const initEl = document.getElementById('compareInitial');
        if (initEl) {
            try { items = JSON.parse(initEl.textContent) || []; } catch (e) { items = []; }
        }

        function extractGo(volume) {
            if (!volume) return null;
            const m = String(volume).match(/([\d]+(?:[.,]\d+)?)\s*(go|mo)/i);
            if (!m) return null;
            const val = parseFloat(m[1].replace(',', '.'));
            return m[2].toLowerCase() === 'mo' ? val / 1024 : val;
        }

        function render() {
            const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));

            if (items.length === 0) {
                table.hidden = true;
                if (emptyEl) emptyEl.hidden = false;
                return;
            }
            table.hidden = false;
            if (emptyEl) emptyEl.hidden = true;

            // Calcule le prix au Go et le meilleur.
            let bestIdx = -1, bestVal = Infinity;
            items.forEach((f, i) => {
                const go = extractGo(f.volume_data);
                f._go = go;
                f._prixGo = (go && go > 0) ? Math.round(f.prix / go) : null;
                if (f._prixGo !== null && f._prixGo < bestVal) { bestVal = f._prixGo; bestIdx = i; }
            });

            const cols = items.map((f, i) => `<th class="compare-col-head ${i === bestIdx ? 'compare-col-best' : ''}">
                <span class="op-badge" style="background:${esc(f.operateur_couleur)}">${esc(f.operateur)}</span><br>${esc(f.nom)}
                ${i === bestIdx ? '<br><span class="best-flag">Meilleur prix/Go</span>' : ''}
                <br><button type="button" class="compare-remove" data-id="${f.id}">✕ retirer</button>
            </th>`).join('');

            const row = (label, fn) => `<tr><th class="row-label">${label}</th>${items.map((f, i) =>
                `<td class="${i === bestIdx ? 'compare-col-best' : ''}">${fn(f)}</td>`).join('')}</tr>`;

            table.innerHTML = `
                <thead><tr><th class="row-label"></th>${cols}</tr></thead>
                <tbody>
                    ${row('Prix', (f) => `<strong>${fcfa(f.prix)}</strong>`)}
                    ${row('Internet', (f) => esc(f.volume_data || '—'))}
                    ${row('Appels', (f) => esc(f.minutes_appel || '—'))}
                    ${row('SMS', (f) => esc(f.sms || '—'))}
                    ${row('Validité', (f) => esc(f.validite || '—'))}
                    ${row('Prix au Go', (f) => f._prixGo !== null ? `<span class="compare-prix-go">${fcfa(f._prixGo)}/Go</span>` : '—')}
                    ${row('Code', (f) => f.code_ussd
                        ? `<a class="btn btn-primary btn-sm" href="${telLink(esc(f.code_ussd))}">📲 Composer</a>`
                        : '—')}
                </tbody>`;
        }

        // Ajout via le sélecteur.
        pick.addEventListener('change', async () => {
            const id = parseInt(pick.value, 10);
            if (!id) return;
            if (items.length >= 3) { toast('3 forfaits maximum', 'err'); pick.value = ''; return; }
            if (items.some((f) => f.id === id)) { pick.value = ''; return; }
            // Récupère les détails via l'API comparateur.
            const ids = items.map((f) => f.id).concat(id);
            await load(ids);
            pick.value = '';
        });

        // Retrait d'une colonne.
        table.addEventListener('click', (e) => {
            const btn = e.target.closest('.compare-remove');
            if (btn) {
                const id = parseInt(btn.getAttribute('data-id'), 10);
                items = items.filter((f) => f.id !== id);
                syncUrl();
                render();
            }
        });

        async function load(ids) {
            try {
                const res = await fetch(url('/api/comparer') + '?ids=' + ids.join(','));
                const data = await res.json();
                items = data.forfaits.map((f) => ({
                    id: f.id, nom: f.nom, operateur: f.operateur_nom,
                    operateur_couleur: f.operateur_couleur, prix: f.prix,
                    volume_data: f.volume_data, minutes_appel: f.minutes_appel,
                    sms: f.sms, validite: f.validite, code_ussd: f.code_ussd
                }));
                syncUrl();
                render();
            } catch (e) { toast('Erreur de chargement', 'err'); }
        }

        function syncUrl() {
            const ids = items.map((f) => f.id);
            history.replaceState(null, '', url('/comparer') + (ids.length ? '?ids=' + ids.join(',') : ''));
        }

        render();
    })();

    /* ------------------------------------------------------------------ */
    /* Générateur USSD (fonctionnalité phare)                             */
    /* ------------------------------------------------------------------ */
    (function ussdInit() {
        const form = document.getElementById('ussdForm');
        if (!form) return;

        const numeroEl = document.getElementById('ussdNumero');
        const opDetect = document.getElementById('opDetect');
        const actionEl = document.getElementById('ussdAction');
        const montantField = document.getElementById('montantField');
        const codeField = document.getElementById('codeField');
        const errorEl = document.getElementById('ussdError');
        const result = document.getElementById('ussdResult');

        let patterns = {};
        const pEl = document.getElementById('ussdPatterns');
        if (pEl) { try { patterns = JSON.parse(pEl.textContent) || {}; } catch (e) { patterns = {}; } }

        let currentSlug = null;

        // Détection en direct de l'opérateur.
        numeroEl.addEventListener('input', () => {
            const op = detectOperateur(numeroEl.value);
            currentSlug = op ? op.slug : null;
            if (!numeroEl.value.trim()) {
                opDetect.innerHTML = '<span class="op-detect-idle">Opérateur détecté ici…</span>';
            } else if (op) {
                opDetect.innerHTML = `<span class="op-detect-badge" style="background:${op.couleur}">${op.nom} détecté ✓</span>`;
            } else {
                opDetect.innerHTML = '<span class="op-detect-error">Numéro incomplet ou non reconnu (07 · 05 · 01)</span>';
            }
            refreshFields();
        });

        actionEl.addEventListener('change', refreshFields);

        /** Adapte les champs montant/code selon l'action et le pattern. */
        function refreshFields() {
            const action = actionEl.value;
            const pattern = findPattern(currentSlug, action);
            const needsMontant = pattern ? pattern.includes('{montant}') : (action === 'achat_credit' || action === 'transfert_credit');
            const needsCode = pattern ? pattern.includes('{code}') : false;
            montantField.hidden = !needsMontant;
            codeField.hidden = !needsCode;
        }

        function findPattern(slug, action) {
            if (!slug || !patterns[slug]) return null;
            const found = patterns[slug].find((c) => c.action === action);
            return found ? found.pattern : null;
        }

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.hidden = false;
            result.hidden = true;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.hidden = true;

            const op = detectOperateur(numeroEl.value);
            if (!op) { showError('Numéro invalide : 10 chiffres attendus (07 · 05 · 01).'); return; }

            const action = actionEl.value;
            const montant = document.getElementById('ussdMontant').value;
            const code = document.getElementById('ussdCode').value;

            // Appel serveur (validation + génération de référence).
            try {
                const body = new URLSearchParams();
                body.append('numero', numeroEl.value);
                body.append('operateur', op.slug);
                body.append('action', action);
                body.append('montant', montant);
                body.append('code', code);
                body.append('_csrf', CSRF);

                const res = await fetch(url('/api/generer-code'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
                    body: body.toString()
                });
                const data = await res.json();
                if (!res.ok) { showError(data.error || 'Génération impossible.'); return; }
                showResult(data, op);
            } catch (err) {
                showError('Erreur réseau. Réessayez.');
            }
        });

        function showResult(data, op) {
            const opTag = document.getElementById('ussdResultOp');
            opTag.textContent = op.nom;
            opTag.style.background = op.couleur;
            document.getElementById('ussdResultLabel').textContent = data.libelle || 'Votre code';
            document.getElementById('ussdResultCode').textContent = data.code;
            document.getElementById('ussdDial').setAttribute('href', data.tel);
            const copy = document.getElementById('ussdCopy');
            copy.setAttribute('data-copy', data.code);
            result.hidden = false;
            result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        refreshFields();
    })();

    /* ------------------------------------------------------------------ */
    /* Filtre de tableau admin (recherche instantanée côté client)        */
    /* ------------------------------------------------------------------ */
    (function adminTableFilter() {
        document.querySelectorAll('.admin-search[data-table]').forEach((input) => {
            const table = document.getElementById(input.getAttribute('data-table'));
            if (!table) return;
            input.addEventListener('input', () => {
                const q = input.value.trim().toLowerCase();
                table.querySelectorAll('tbody tr').forEach((tr) => {
                    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            });
        });
    })();

})();

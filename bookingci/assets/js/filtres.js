/* =====================================================================
 * BookingCI — filtres.js
 * Filtrage / tri côté client des pages de listing (restaurants & résidences).
 *
 * Séparation logique métier / DOM :
 *   - appliquerFiltres() : fonction pure (données -> données) testable
 *   - le reste gère l'UI (lecture des contrôles, rendu des cartes)
 *
 * La page indique son type via <body data-listing="restaurant|residence">.
 * ===================================================================== */

(function () {
  'use strict';

  const BCI = window.BookingCI;
  const UI = window.BCUI;
  const $ = UI.$, $$ = UI.$$;

  const listingType = document.body.dataset.listing;
  if (!listingType) return; // pas une page de listing

  // État courant des filtres
  const state = {
    ville: '',
    commune: '',
    prixMax: null,
    cuisine: '',       // restaurants
    chambresMin: 0,    // résidences
    tri: 'populaire',
    recherche: ''
  };

  let source = [];       // jeu de données complet
  let prixPlafond = 0;   // borne max du slider

  /* ---------------------------------------------------------------
   * Logique métier — fonction pure de filtrage/tri
   * ------------------------------------------------------------- */
  function appliquerFiltres(items, f) {
    let out = items.filter(function (e) {
      if (f.ville && e.ville !== f.ville) return false;
      if (f.commune && e.commune !== f.commune) return false;
      if (f.prixMax != null && e.prix > f.prixMax) return false;
      if (f.cuisine && e.cuisine !== f.cuisine) return false;
      if (f.chambresMin && (e.chambres || 0) < f.chambresMin) return false;
      if (f.recherche) {
        const q = f.recherche.toLowerCase();
        const hay = (e.nom + ' ' + e.commune + ' ' + e.ville + ' ' + (e.cuisine || e.categorie || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    const tris = {
      'populaire': function (a, b) { return b.populaire - a.populaire; },
      'prix-asc': function (a, b) { return a.prix - b.prix; },
      'prix-desc': function (a, b) { return b.prix - a.prix; },
      'note': function (a, b) { return b.note - a.note; }
    };
    out.sort(tris[f.tri] || tris.populaire);
    return out;
  }

  /* ---------------------------------------------------------------
   * Rendu
   * ------------------------------------------------------------- */
  function rendre() {
    const grid = $('#cards-grid');
    const countEl = $('#listing-count');
    const results = appliquerFiltres(source, state);

    grid.innerHTML = '';
    if (!results.length) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' +
        '<div class="emoji">🔍</div><h3>Aucun résultat</h3>' +
        '<p class="muted">Essayez d\'élargir vos critères ou de réinitialiser les filtres.</p></div>';
    } else {
      results.forEach(function (e) { grid.appendChild(UI.carteEtablissement(e)); });
    }
    if (countEl) {
      countEl.textContent = results.length + ' ' +
        (listingType === 'restaurant' ? 'restaurant' : 'résidence') + (results.length > 1 ? 's' : '') + ' trouvé' + (results.length > 1 ? 's' : '');
    }
    UI.initReveal();
  }

  /* ---------------------------------------------------------------
   * Construction des contrôles de filtre
   * ------------------------------------------------------------- */
  function peuplerVilles() {
    const sel = $('#f-ville');
    BCI.VILLES.forEach(function (v) {
      const opt = document.createElement('option');
      opt.value = v.nom; opt.textContent = v.nom;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      state.ville = sel.value;
      peuplerCommunes();
      state.commune = '';
      $('#f-commune').value = '';
      rendre();
    });
  }

  function peuplerCommunes() {
    const sel = $('#f-commune');
    sel.innerHTML = '<option value="">Toutes communes / quartiers</option>';
    const ville = BCI.VILLES.find(function (v) { return v.nom === state.ville; });
    const communes = ville ? ville.communes : dedup(source.map(function (e) { return e.commune; }));
    communes.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    sel.addEventListener('change', function () { state.commune = sel.value; rendre(); }, { once: false });
  }

  function peuplerCritereSpecifique() {
    if (listingType === 'restaurant') {
      const sel = $('#f-cuisine');
      BCI.TYPES_CUISINE.forEach(function (c) {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { state.cuisine = sel.value; rendre(); });
    } else {
      const sel = $('#f-chambres');
      sel.addEventListener('change', function () { state.chambresMin = parseInt(sel.value, 10) || 0; rendre(); });
    }
  }

  function initPrix() {
    prixPlafond = source.reduce(function (m, e) { return Math.max(m, e.prix); }, 0);
    const range = $('#f-prix');
    const out = $('#f-prix-val');
    range.min = 0;
    range.max = prixPlafond;
    range.step = listingType === 'restaurant' ? 500 : 5000;
    range.value = prixPlafond;
    state.prixMax = prixPlafond;
    out.textContent = BCI.formatFCFA(prixPlafond);
    range.addEventListener('input', function () {
      state.prixMax = parseInt(range.value, 10);
      out.textContent = BCI.formatFCFA(state.prixMax);
    });
    range.addEventListener('change', rendre);
  }

  function initTri() {
    const sel = $('#f-tri');
    sel.addEventListener('change', function () { state.tri = sel.value; rendre(); });
  }

  function initRecherche() {
    const input = $('#f-recherche');
    if (!input) return;
    let timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.recherche = input.value.trim(); rendre(); }, 200);
    });
  }

  function initReset() {
    const btn = $('#f-reset');
    if (!btn) return;
    btn.addEventListener('click', function () {
      state.ville = ''; state.commune = ''; state.cuisine = ''; state.chambresMin = 0;
      state.recherche = ''; state.tri = 'populaire';
      state.prixMax = prixPlafond;
      $('#f-ville').value = '';
      $('#f-commune').value = '';
      $('#f-tri').value = 'populaire';
      if ($('#f-recherche')) $('#f-recherche').value = '';
      if ($('#f-cuisine')) $('#f-cuisine').value = '';
      if ($('#f-chambres')) $('#f-chambres').value = '0';
      $('#f-prix').value = prixPlafond;
      $('#f-prix-val').textContent = BCI.formatFCFA(prixPlafond);
      peuplerCommunes();
      rendre();
    });
  }

  // Bascule d'affichage des filtres sur mobile
  function initFiltersToggle() {
    const toggle = $('#filters-toggle');
    const panel = $('#filters-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      const open = panel.classList.toggle('is-open-mobile');
      panel.style.display = open ? 'block' : '';
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  function dedup(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; }).sort();
  }

  /* ---------------------------------------------------------------
   * Pré-remplissage depuis l'URL (ex. ?ville=Abidjan)
   * ------------------------------------------------------------- */
  function appliquerParamsURL() {
    const params = new URLSearchParams(window.location.search);
    const ville = params.get('ville');
    if (ville) {
      state.ville = ville;
      $('#f-ville').value = ville;
      peuplerCommunes();
    }
    const q = params.get('q');
    if (q && $('#f-recherche')) { state.recherche = q; $('#f-recherche').value = q; }
  }

  /* ---------------------------------------------------------------
   * Démarrage : chargement des données via l'"API"
   * ------------------------------------------------------------- */
  BCI.api.getEtablissements(listingType).then(function (data) {
    source = data;
    peuplerVilles();
    peuplerCommunes();
    peuplerCritereSpecifique();
    initPrix();
    initTri();
    initRecherche();
    initReset();
    initFiltersToggle();
    appliquerParamsURL();
    rendre();
  });

  // Exposition pour d'éventuels tests unitaires futurs
  window.BCFiltres = { appliquerFiltres: appliquerFiltres };

})();

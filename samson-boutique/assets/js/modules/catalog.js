/* =====================================================================
   SAMSON BOUTIQUE — Catalogue : grille, filtres, tri, recherche, pagination
   ===================================================================== */
(function () {
  'use strict';

  const PAR_PAGE = 8;
  let etat = {
    q: '', categories: [], marques: [], prixMax: null, dispo: false,
    noteMin: 0, tri: 'pertinence', page: 1
  };

  const norm = s => SB.search.normalise(s);

  function tousProduits() { return window.SB_DATA.produits.slice(); }

  function marquesDispo() {
    return [...new Set(tousProduits().map(p => p.marque))].sort();
  }
  function prixMaxGlobal() {
    return Math.max(...tousProduits().map(p => SB.prixEffectif(p)));
  }

  function filtrer() {
    let list = tousProduits();
    if (etat.q) {
      const q = norm(etat.q);
      list = list.filter(p => {
        const cat = (window.SB_DATA.categories.find(c => c.id === p.categorie) || {}).nom || '';
        return norm(p.nom).includes(q) || norm(cat).includes(q) || norm(p.marque).includes(q);
      });
    }
    if (etat.categories.length) list = list.filter(p => etat.categories.includes(p.categorie));
    if (etat.marques.length) list = list.filter(p => etat.marques.includes(p.marque));
    if (etat.prixMax != null) list = list.filter(p => SB.prixEffectif(p) <= etat.prixMax);
    if (etat.dispo) list = list.filter(p => p.stock > 0);
    if (etat.noteMin) list = list.filter(p => p.note >= etat.noteMin);

    switch (etat.tri) {
      case 'prix-asc':  list.sort((a, b) => SB.prixEffectif(a) - SB.prixEffectif(b)); break;
      case 'prix-desc': list.sort((a, b) => SB.prixEffectif(b) - SB.prixEffectif(a)); break;
      case 'nouveautes': list.sort((a, b) => (b.badges.includes('Nouveau') ? 1 : 0) - (a.badges.includes('Nouveau') ? 1 : 0)); break;
      case 'ventes': list.sort((a, b) => b.avisCount - a.avisCount); break;
      case 'note': list.sort((a, b) => b.note - a.note); break;
    }
    return list;
  }

  function render() {
    const grid = document.getElementById('produits-grid');
    if (!grid) return;
    const list = filtrer();
    const countEl = document.getElementById('count-res');
    if (countEl) countEl.textContent = `${list.length} produit${list.length > 1 ? 's' : ''}`;

    // Pagination
    const totalPages = Math.max(1, Math.ceil(list.length / PAR_PAGE));
    if (etat.page > totalPages) etat.page = totalPages;
    const debut = (etat.page - 1) * PAR_PAGE;
    const pageItems = list.slice(debut, debut + PAR_PAGE);

    if (!list.length) {
      grid.innerHTML = `<div class="no-results" style="grid-column:1/-1">
        <div class="big">🔍</div>
        <h3>Aucun produit trouvé</h3>
        <p class="muted">Essayez de modifier vos filtres.</p>
        <button class="btn btn-outline" style="margin-top:16px" onclick="SB.catalog.reset()">Réinitialiser les filtres</button>
      </div>`;
      renderPagination(0);
      return;
    }

    grid.innerHTML = pageItems.map(SB.renderCard).join('');
    renderPagination(totalPages);
    SB.observeReveal && SB.observeReveal();
  }

  function renderPagination(totalPages) {
    const pag = document.getElementById('pagination');
    if (!pag) return;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    let html = `<button ${etat.page === 1 ? 'disabled' : ''} onclick="SB.catalog.goPage(${etat.page - 1})">‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === etat.page ? 'active' : ''}" onclick="SB.catalog.goPage(${i})">${i}</button>`;
    }
    html += `<button ${etat.page === totalPages ? 'disabled' : ''} onclick="SB.catalog.goPage(${etat.page + 1})">›</button>`;
    pag.innerHTML = html;
  }

  function goPage(n) { etat.page = n; render(); window.scrollTo({ top: 200, behavior: 'smooth' }); }

  function reset() {
    etat = { q: '', categories: [], marques: [], prixMax: null, dispo: false, noteMin: 0, tri: 'pertinence', page: 1 };
    construireFiltres();
    render();
  }

  /* ---- Construction de la sidebar de filtres ---- */
  function construireFiltres() {
    const box = document.getElementById('filters-body');
    if (!box) return;
    const esc = SB.security.escapeHtml;
    const cats = window.SB_DATA.categories;
    const pmax = prixMaxGlobal();
    const curPrix = etat.prixMax == null ? pmax : etat.prixMax;

    box.innerHTML = `
      <div class="filter-group">
        <h4>Catégories</h4>
        ${cats.map(c => {
          const n = tousProduits().filter(p => p.categorie === c.id).length;
          return `<label class="check"><input type="checkbox" value="${c.id}" data-filter="cat" ${etat.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)} <span class="cnt">${n}</span></label>`;
        }).join('')}
      </div>
      <div class="filter-group">
        <h4>Prix maximum</h4>
        <div class="price-range">
          <input type="range" min="0" max="${pmax}" step="1000" value="${curPrix}" data-filter="prix">
          <div class="vals"><span>0 FCFA</span><span id="prix-val">${SB.formatPrix(curPrix)}</span></div>
        </div>
      </div>
      <div class="filter-group">
        <h4>Marque</h4>
        ${marquesDispo().map(m => `<label class="check"><input type="checkbox" value="${esc(m)}" data-filter="marque" ${etat.marques.includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('')}
      </div>
      <div class="filter-group">
        <h4>Note minimale</h4>
        ${[4.5, 4, 0].map(n => `<label class="check"><input type="radio" name="note" value="${n}" data-filter="note" ${etat.noteMin === n ? 'checked' : ''}> ${n ? '★ ' + n + ' et +' : 'Toutes les notes'}</label>`).join('')}
      </div>
      <div class="filter-group">
        <label class="check"><input type="checkbox" data-filter="dispo" ${etat.dispo ? 'checked' : ''}> En stock uniquement</label>
      </div>
      <button class="btn btn-ghost btn-block btn-sm" onclick="SB.catalog.reset()">Réinitialiser</button>
    `;

    box.querySelectorAll('[data-filter]').forEach(inp => {
      inp.addEventListener('input', () => {
        etat.page = 1;
        const f = inp.dataset.filter;
        if (f === 'cat') etat.categories = getChecked(box, 'cat');
        if (f === 'marque') etat.marques = getChecked(box, 'marque');
        if (f === 'dispo') etat.dispo = inp.checked;
        if (f === 'note') etat.noteMin = parseFloat(inp.value);
        if (f === 'prix') {
          etat.prixMax = parseInt(inp.value, 10);
          const v = document.getElementById('prix-val'); if (v) v.textContent = SB.formatPrix(etat.prixMax);
        }
        render();
      });
    });
  }

  function getChecked(box, filter) {
    return Array.from(box.querySelectorAll(`[data-filter="${filter}"]:checked`)).map(i => i.value);
  }

  function init() {
    if (!document.getElementById('produits-grid')) return;

    // Pré-remplissage depuis l'URL (?q= ou ?cat=)
    const params = new URLSearchParams(location.search);
    if (params.get('q')) etat.q = params.get('q');
    if (params.get('cat')) etat.categories = [params.get('cat')];

    construireFiltres();

    // Barre de recherche live du catalogue
    const searchLive = document.getElementById('catalogue-search');
    if (searchLive) {
      searchLive.value = etat.q;
      let t; searchLive.addEventListener('input', () => {
        clearTimeout(t); t = setTimeout(() => { etat.q = searchLive.value; etat.page = 1; render(); }, 150);
      });
    }

    // Tri
    const triSel = document.getElementById('tri-select');
    if (triSel) triSel.addEventListener('change', () => { etat.tri = triSel.value; etat.page = 1; render(); });

    // Drawer filtres mobile
    const openBtn = document.getElementById('open-filters');
    const filtersEl = document.getElementById('filters');
    const overlay = document.getElementById('overlay');
    if (openBtn && filtersEl) {
      openBtn.addEventListener('click', () => { filtersEl.classList.add('open'); overlay && overlay.classList.add('show'); });
    }

    // Skeleton loaders puis rendu (simule un chargement)
    const grid = document.getElementById('produits-grid');
    grid.innerHTML = Array(6).fill(`<div class="skel-card"><div class="skel-media skeleton"></div><div class="skel-line skeleton"></div><div class="skel-line short skeleton"></div></div>`).join('');
    setTimeout(render, 400);
  }

  SB.catalog = { init, render, reset, goPage, etat };
  document.addEventListener('DOMContentLoaded', init);
})();

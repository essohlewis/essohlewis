/* =====================================================================
   SAMSON BOUTIQUE — Recherche globale + suggestions instantanées
   ===================================================================== */
(function () {
  'use strict';

  function normalise(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* Filtre les produits sur nom, catégorie, marque */
  function rechercher(terme) {
    const q = normalise(terme).trim();
    if (!q) return [];
    return (window.SB_DATA.produits || []).filter(p => {
      const cat = (window.SB_DATA.categories.find(c => c.id === p.categorie) || {}).nom || '';
      return normalise(p.nom).includes(q) ||
             normalise(cat).includes(q) ||
             normalise(p.marque).includes(q);
    });
  }

  /* Branche une barre de recherche + son dropdown de suggestions */
  function brancher(input, dropdown) {
    if (!input) return;
    const esc = SB.security.escapeHtml;

    function fermer() { if (dropdown) dropdown.innerHTML = ''; }

    function afficher() {
      const q = input.value;
      if (!dropdown) return;
      if (!q.trim()) { fermer(); return; }
      const res = rechercher(q).slice(0, 6);
      if (!res.length) {
        dropdown.innerHTML = `<div class="empty">Aucun résultat pour « ${esc(q)} »</div>`;
        return;
      }
      dropdown.innerHTML = res.map(p =>
        `<a href="produit.html?id=${p.id}">
           <img class="sg-img" src="${SB.produitImage(p)}" alt="" loading="lazy">
           <span style="flex:1">
             <span class="sg-nom">${esc(p.nom)}</span><br>
             <span class="sg-prix">${SB.formatPrix(SB.prixEffectif(p))}</span>
           </span>
         </a>`).join('');
    }

    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(afficher, 120); });
    input.addEventListener('focus', afficher);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.value.trim()) location.href = 'catalogue.html?q=' + encodeURIComponent(input.value.trim());
      }
      if (e.key === 'Escape') fermer();
    });
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== input) fermer();
    });
  }

  SB.search = { rechercher, brancher, normalise };
})();

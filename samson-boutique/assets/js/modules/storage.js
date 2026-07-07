/* =====================================================================
   SAMSON BOUTIQUE — Core + Storage
   ---------------------------------------------------------------------
   Ce module initialise l'espace de noms global `SB` (chargé en premier
   après les données) : utilitaires partagés + accès localStorage résilient.
   ===================================================================== */
(function () {
  'use strict';

  const PREFIX = 'sb_';

  /* ---- localStorage sécurisé (try/catch : mode privé, quota…) ---- */
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} },
    session: {
      get(key, fallback = null) {
        try { const r = sessionStorage.getItem(PREFIX + key); return r === null ? fallback : JSON.parse(r); }
        catch (e) { return fallback; }
      },
      set(key, value) { try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {} },
      remove(key) { try { sessionStorage.removeItem(PREFIX + key); } catch (e) {} }
    }
  };

  /* ---- Formatage prix FCFA : 25 000 FCFA ---- */
  function formatPrix(n, avecDevise = true) {
    const s = Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return avecDevise ? s + ' FCFA' : s;
  }

  /* ---- Génération d'image produit en SVG (data URI) ---- */
  const catGrad = {
    musculation: ['#FF6B00', '#E65100'], cardio: ['#FF8A3D', '#FF6B00'],
    fitness: ['#FFA05C', '#E65100'], accessoires: ['#FF6B00', '#C43E00'],
    nutrition: ['#FF7A1A', '#E65100'], vetements: ['#FF9142', '#E65100'],
    equipement: ['#FF6B00', '#B33800']
  };
  function produitImage(prod, variante = 0) {
    const g = catGrad[prod.categorie] || ['#FF6B00', '#E65100'];
    const emoji = prod.emoji || '🏋️';
    // Léger décalage de teinte selon la variante pour simuler des angles/couleurs
    const rot = variante * 18;
    const svg =
`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${g[0]}'/><stop offset='1' stop-color='${g[1]}'/>
    </linearGradient>
    <radialGradient id='r' cx='0.3' cy='0.25' r='0.9'>
      <stop offset='0' stop-color='rgba(255,255,255,0.35)'/><stop offset='1' stop-color='rgba(255,255,255,0)'/>
    </radialGradient>
  </defs>
  <rect width='600' height='600' fill='url(#g)' transform='rotate(${rot} 300 300)'/>
  <rect width='600' height='600' fill='url(#r)'/>
  <g opacity='0.12' fill='#fff'>
    <circle cx='500' cy='110' r='170'/><circle cx='90' cy='520' r='130'/>
  </g>
  <text x='300' y='300' font-size='230' text-anchor='middle' dominant-baseline='central'>${emoji}</text>
  <text x='300' y='545' font-size='30' font-family='Poppins,sans-serif' font-weight='700' fill='rgba(255,255,255,0.85)' text-anchor='middle'>SAMSON</text>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---- Petits helpers DOM ---- */
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); }

  /* ---- Récupère un produit par id ---- */
  function getProduit(id) {
    return (window.SB_DATA?.produits || []).find(p => p.id === id) || null;
  }
  function prixEffectif(p) { return p.prixPromo != null ? p.prixPromo : p.prix; }

  /* ---- Bus d'événements maison (mise à jour panier/wishlist) ---- */
  const bus = {
    _l: {},
    on(evt, fn) { (this._l[evt] = this._l[evt] || []).push(fn); },
    emit(evt, data) { (this._l[evt] || []).forEach(fn => fn(data)); }
  };

  /* ---- Effet ripple sur les boutons .btn ---- */
  function attachRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = document.createElement('span');
      r.className = 'ripple';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.width = r.style.height = size + 'px';
      r.style.left = (e.clientX - rect.left - size / 2) + 'px';
      r.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  }

  window.SB = {
    store, formatPrix, produitImage, qs, qsa, on, bus,
    getProduit, prixEffectif, attachRipple,
    WHATSAPP: '2250700000000' // numéro de contact (démo)
  };
})();

/* =====================================================================
   SAMSON BOUTIQUE — Fiche produit (galerie, variantes, onglets, avis)
   ===================================================================== */
(function () {
  'use strict';

  const esc = s => SB.security.escapeHtml(s);
  let selection = {}; // variante sélectionnée
  let qte = 1;
  let imgIndex = 0;

  function noteEtoiles(note) {
    const pleines = Math.round(note);
    return '★'.repeat(pleines) + '☆'.repeat(5 - pleines);
  }

  function stockInfo(p) {
    if (p.stock <= 0) return { cls: 'out', txt: 'Rupture de stock' };
    if (p.stock <= 5) return { cls: 'low', txt: `Plus que ${p.stock} en stock — dépêchez-vous !` };
    return { cls: 'ok', txt: `En stock (${p.stock} disponibles)` };
  }

  // Avis fictifs générés de façon déterministe
  function avisFictifs(p) {
    const noms = ['Koffi A.', 'Aïcha D.', 'Yao K.', 'Mariam T.', 'Serge B.', 'Fatou C.'];
    const textes = [
      'Produit de qualité, livraison rapide à Cocody. Je recommande !',
      'Conforme à la description, très satisfait de mon achat.',
      'Excellent rapport qualité-prix, emballage soigné.',
      'Bon matériel, solide. Le service client SAMSON est réactif.',
      'Parfait pour mon entraînement à la maison. Rien à redire.'
    ];
    const n = Math.min(3, Math.max(2, Math.round(p.note)));
    return Array.from({ length: n }, (_, i) => ({
      nom: noms[(p.nom.length + i) % noms.length],
      note: Math.min(5, Math.round(p.note) + (i === 1 ? -1 : 0)),
      texte: textes[(p.avisCount + i) % textes.length]
    }));
  }

  function renderGalerie(p) {
    const imgs = [0, 1, 2]; // angles générés
    const main = document.getElementById('pd-main-img');
    const thumbs = document.getElementById('pd-thumbs');
    if (main) main.innerHTML = `<img id="zoom-img" src="${SB.produitImage(p, imgIndex)}" alt="${esc(p.nom)}">`;
    if (thumbs) thumbs.innerHTML = imgs.map(i =>
      `<button class="${i === imgIndex ? 'active' : ''}" onclick="SB.product.setImg(${i})" aria-label="Vue ${i + 1}">
         <img src="${SB.produitImage(p, i)}" alt=""></button>`).join('');
    const zi = document.getElementById('zoom-img');
    if (zi) zi.addEventListener('click', () => zi.classList.toggle('zoomed'));
  }

  function setImg(i) { imgIndex = i; renderGalerie(window.SB.product._p); }

  function renderVariantes(p) {
    const box = document.getElementById('pd-variantes');
    if (!box) return;
    let html = '';
    const groupes = [
      { key: 'couleur', label: 'Couleur', vals: p.couleurs },
      { key: 'taille', label: 'Taille', vals: p.tailles },
      { key: 'saveur', label: 'Saveur', vals: p.saveurs }
    ];
    groupes.forEach(g => {
      if (!g.vals || !g.vals.length) return;
      selection[g.key] = selection[g.key] || g.vals[0];
      html += `<div class="variant-group">
        <div class="vg-label">${g.label} : <span class="accent" data-sel="${g.key}">${esc(selection[g.key])}</span></div>
        <div class="variant-options">
          ${g.vals.map(v => `<button class="variant-opt ${v === selection[g.key] ? 'selected' : ''}" data-group="${g.key}" data-val="${esc(v)}">${esc(v)}</button>`).join('')}
        </div></div>`;
    });
    box.innerHTML = html;
    box.querySelectorAll('.variant-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        selection[g] = btn.dataset.val;
        box.querySelectorAll(`[data-group="${g}"]`).forEach(b => b.classList.toggle('selected', b === btn));
        const lbl = box.querySelector(`[data-sel="${g}"]`); if (lbl) lbl.textContent = btn.dataset.val;
      });
    });
  }

  function renderOnglets(p) {
    document.getElementById('tab-desc').innerHTML = `<p>${esc(p.description)}</p>`;
    document.getElementById('tab-carac').innerHTML =
      `<ul class="carac-list">${p.caracteristiques.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
    document.getElementById('tab-livraison').innerHTML =
      `<p>🚚 <strong>Livraison à Abidjan</strong> sous 24 à 48h. Communes centrales (Cocody, Plateau, Marcory) : 1 000 FCFA. Autres communes : 1 500 FCFA. Intérieur du pays : 2 500 FCFA.</p>
       <p style="margin-top:10px">🎁 <strong>Livraison offerte</strong> dès 50 000 FCFA d'achat.</p>
       <p style="margin-top:10px">↩️ <strong>Retour</strong> possible sous 7 jours si le produit est neuf et non utilisé.</p>`;
    const avis = avisFictifs(p);
    document.getElementById('tab-avis').innerHTML =
      `<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
         <div style="font-size:2.4rem;font-weight:800;font-family:var(--font-titre)">${p.note}</div>
         <div><div class="stars">${noteEtoiles(p.note)}</div><div class="muted" style="font-size:.82rem">${p.avisCount} avis clients</div></div>
       </div>
       ${avis.map(a => `<div class="avis-item">
         <div class="avis-head"><div class="avis-av">${esc(a.nom[0])}</div>
         <div><strong>${esc(a.nom)}</strong><div class="stars">${noteEtoiles(a.note)}</div></div></div>
         <p style="font-size:.9rem">${esc(a.texte)}</p></div>`).join('')}`;
  }

  function renderSimilaires(p) {
    const box = document.getElementById('pd-similaires');
    if (!box) return;
    const sim = window.SB_DATA.produits.filter(x => x.categorie === p.categorie && x.id !== p.id).slice(0, 4);
    box.innerHTML = sim.map(SB.renderCard).join('');
  }

  function init() {
    const host = document.getElementById('produit-detail');
    if (!host) return;
    const id = new URLSearchParams(location.search).get('id');
    const p = SB.getProduit(id) || window.SB_DATA.produits[0];
    window.SB.product._p = p;
    document.title = `${p.nom} — SAMSON Boutique`;

    const cat = window.SB_DATA.categories.find(c => c.id === p.categorie);
    const st = stockInfo(p);
    const enPromo = p.prixPromo != null;
    const bc = document.getElementById('pd-breadcrumb');
    if (bc) bc.innerHTML = `<a href="index.html">Accueil</a> › <a href="catalogue.html?cat=${p.categorie}">${esc(cat ? cat.nom : '')}</a> › <span>${esc(p.nom)}</span>`;

    document.getElementById('pd-cat').textContent = cat ? cat.nom : '';
    document.getElementById('pd-nom').textContent = p.nom;
    document.getElementById('pd-meta').innerHTML =
      `<span class="stars">${noteEtoiles(p.note)} <span class="count">(${p.avisCount})</span></span>
       <span class="muted">·</span><span class="muted">Marque : <strong>${esc(p.marque)}</strong></span>`;
    document.getElementById('pd-price').innerHTML =
      `<span class="prix-actuel">${SB.formatPrix(SB.prixEffectif(p))}</span>
       ${enPromo ? `<span class="prix-barre">${SB.formatPrix(p.prix)}</span>
       <span class="save">−${Math.round((1 - p.prixPromo / p.prix) * 100)}%</span>` : ''}`;
    document.getElementById('pd-stock').className = 'pd-stock ' + st.cls;
    document.getElementById('pd-stock').innerHTML = `<span class="dot"></span> ${st.txt}`;

    renderGalerie(p);
    renderVariantes(p);
    renderOnglets(p);
    renderSimilaires(p);

    // Quantité
    const qEl = document.getElementById('pd-qty-val');
    document.getElementById('pd-qty-minus').addEventListener('click', () => { qte = Math.max(1, qte - 1); qEl.textContent = qte; });
    document.getElementById('pd-qty-plus').addEventListener('click', () => { qte = Math.min(p.stock || 1, qte + 1); qEl.textContent = qte; });

    // Ajout panier / achat immédiat
    const btnAdd = document.getElementById('pd-add');
    const btnBuy = document.getElementById('pd-buy');
    if (p.stock <= 0) { btnAdd.disabled = true; btnBuy.disabled = true; btnAdd.textContent = 'Indisponible'; }
    btnAdd.addEventListener('click', () => SB.cart.ajouter(p.id, qte, { ...selection }));
    btnBuy.addEventListener('click', () => { SB.cart.ajouter(p.id, qte, { ...selection }); setTimeout(() => location.href = 'checkout.html', 500); });

    // Wishlist
    const wb = document.getElementById('pd-wish');
    if (wb) {
      const maj = () => { wb.classList.toggle('active', SB.wishlist.contient(p.id)); wb.innerHTML = (SB.wishlist.contient(p.id) ? '❤️' : '🤍') + ' Favori'; };
      maj();
      wb.addEventListener('click', () => { SB.wishlist.toggle(p.id); maj(); });
    }

    // Onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  }

  SB.product = { init, setImg, _p: null };
  document.addEventListener('DOMContentLoaded', init);
})();

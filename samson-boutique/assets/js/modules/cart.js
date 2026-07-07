/* =====================================================================
   SAMSON BOUTIQUE — Panier (persisté localStorage) + drawer + promo
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'cart';
  const PROMO_KEY = 'cart_promo';

  // Ligne panier : { id, qty, variante: {couleur, taille, saveur} }
  let lignes = SB.store.get(KEY, []);
  let promo = SB.store.get(PROMO_KEY, null);

  function persister() { SB.store.set(KEY, lignes); SB.bus.emit('cart:change', lignes); }

  /* Clé unique d'une ligne (produit + variante) */
  function ligneKey(id, variante) {
    return id + '|' + JSON.stringify(variante || {});
  }

  function ajouter(id, qty = 1, variante = {}) {
    const p = SB.getProduit(id);
    if (!p) return;
    if (p.stock <= 0) { SB.toastErreur('Produit en rupture de stock'); return; }
    const key = ligneKey(id, variante);
    const existante = lignes.find(l => ligneKey(l.id, l.variante) === key);
    const dejaQty = existante ? existante.qty : 0;
    if (dejaQty + qty > p.stock) {
      SB.toastErreur(`Stock limité : ${p.stock} unité(s) disponible(s)`);
      return;
    }
    if (existante) existante.qty += qty;
    else lignes.push({ id, qty, variante });
    persister();
    SB.toastSucces(`${p.nom} ajouté au panier`);
    ouvrir();
    pulseBadge();
  }

  function setQty(key, qty) {
    const l = lignes.find(x => ligneKey(x.id, x.variante) === key);
    if (!l) return;
    const p = SB.getProduit(l.id);
    qty = Math.max(1, Math.min(qty, p ? p.stock : 99));
    l.qty = qty;
    persister();
  }
  function incrementer(key, delta) {
    const l = lignes.find(x => ligneKey(x.id, x.variante) === key);
    if (l) setQty(key, l.qty + delta);
  }
  function retirer(key) {
    lignes = lignes.filter(x => ligneKey(x.id, x.variante) !== key);
    persister();
  }
  function vider() { lignes = []; promo = null; SB.store.remove(PROMO_KEY); persister(); }

  function count() { return lignes.reduce((s, l) => s + l.qty, 0); }
  function items() { return lignes.slice(); }

  function sousTotal() {
    return lignes.reduce((s, l) => {
      const p = SB.getProduit(l.id);
      return s + (p ? SB.prixEffectif(p) * l.qty : 0);
    }, 0);
  }

  /* ---- Codes promo ---- */
  function appliquerPromo(code) {
    code = String(code || '').trim().toUpperCase();
    const def = window.SB_DATA.promos[code];
    if (!def) { SB.toastErreur('Code promo invalide'); return false; }
    promo = { code, ...def };
    SB.store.set(PROMO_KEY, promo);
    SB.bus.emit('cart:change', lignes);
    SB.toastSucces('Code appliqué : ' + def.label);
    return true;
  }
  function retirerPromo() { promo = null; SB.store.remove(PROMO_KEY); SB.bus.emit('cart:change', lignes); }
  function getPromo() { return promo; }

  function remisePromo() {
    if (!promo || promo.type !== 'pourcentage') return 0;
    return Math.round(sousTotal() * promo.valeur / 100);
  }

  /* ---- Totaux avec livraison (zone optionnelle) ---- */
  function totaux(zoneId = null) {
    const st = sousTotal();
    const remise = remisePromo();
    const stApresRemise = st - remise;
    let livraison = 0;
    const L = window.SB_DATA.livraison;
    if (zoneId && L.zones[zoneId]) livraison = L.zones[zoneId].prix;
    // Livraison offerte au-delà du seuil ou via code LIVRAISON0
    const livraisonOfferte = stApresRemise >= L.seuilGratuit || (promo && promo.type === 'livraison');
    if (livraisonOfferte) livraison = 0;
    return {
      sousTotal: st, remise, livraison, livraisonOfferte,
      total: stApresRemise + livraison
    };
  }

  /* ============================= UI drawer ============================= */
  function pulseBadge() {
    document.querySelectorAll('[data-cart-count]').forEach(b => {
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    });
  }

  function majBadges() {
    const n = count();
    document.querySelectorAll('[data-cart-count]').forEach(b => {
      b.textContent = n; b.dataset.n = n; b.style.display = n ? 'grid' : 'none';
    });
    document.querySelectorAll('[data-wish-count]').forEach(b => {
      const w = SB.wishlist.count();
      b.textContent = w; b.dataset.n = w; b.style.display = w ? 'grid' : 'none';
    });
  }

  function ouvrir() {
    const d = document.getElementById('cart-drawer');
    const o = document.getElementById('overlay');
    if (!d) return;
    d.classList.add('open'); o && o.classList.add('show');
    document.body.classList.add('no-scroll');
    render();
  }
  function fermer() {
    const d = document.getElementById('cart-drawer');
    const o = document.getElementById('overlay');
    d && d.classList.remove('open');
    o && o.classList.remove('show');
    document.body.classList.remove('no-scroll');
  }

  function varLabel(v) {
    if (!v) return '';
    return Object.values(v).filter(Boolean).join(' · ');
  }

  function render() {
    const wrap = document.getElementById('cart-items');
    const foot = document.getElementById('cart-foot');
    if (!wrap) return;
    const esc = SB.security.escapeHtml;

    if (!lignes.length) {
      wrap.innerHTML =
        `<div class="cart-empty">
           <div class="big">🛒</div>
           <p>Votre panier est vide.</p>
           <a href="catalogue.html" class="btn btn-primary" style="margin-top:16px" onclick="SB.cart.fermer()">Découvrir la boutique</a>
         </div>`;
      if (foot) foot.style.display = 'none';
      majBadges();
      return;
    }

    wrap.innerHTML = lignes.map(l => {
      const p = SB.getProduit(l.id);
      if (!p) return '';
      const key = ligneKey(l.id, l.variante);
      const vl = varLabel(l.variante);
      return `<div class="cart-line">
        <img src="${SB.produitImage(p)}" alt="${esc(p.nom)}" loading="lazy">
        <div>
          <div class="cl-nom">${esc(p.nom)}</div>
          ${vl ? `<div class="cl-var">${esc(vl)}</div>` : ''}
          <div class="cl-prix">${SB.formatPrix(SB.prixEffectif(p))}</div>
          <div class="cl-qty">
            <button aria-label="Diminuer" onclick="SB.cart.incrementer('${key}',-1)">−</button>
            <span>${l.qty}</span>
            <button aria-label="Augmenter" onclick="SB.cart.incrementer('${key}',1)">+</button>
          </div>
        </div>
        <button class="cl-remove" aria-label="Supprimer" onclick="SB.cart.retirer('${key}')">🗑️</button>
      </div>`;
    }).join('');

    if (foot) {
      foot.style.display = 'block';
      const t = totaux();
      const p = getPromo();
      foot.innerHTML =
        `<div class="promo-row">
           <input class="input" id="promo-input" placeholder="Code promo" aria-label="Code promo" value="${p ? esc(p.code) : ''}">
           <button class="btn btn-dark btn-sm" onclick="SB.cart._promoFromDrawer()">OK</button>
         </div>
         ${p ? `<div class="line" style="color:var(--succes)"><span>🎟️ ${esc(p.label)}</span><button onclick="SB.cart.retirerPromo()" style="color:var(--erreur);font-size:.8rem">retirer</button></div>` : ''}
         <div class="line"><span>Sous-total</span><span>${SB.formatPrix(t.sousTotal)}</span></div>
         ${t.remise ? `<div class="line" style="color:var(--succes)"><span>Remise</span><span>−${SB.formatPrix(t.remise)}</span></div>` : ''}
         <div class="line"><span>Livraison</span><span>${t.livraisonOfferte ? 'Offerte 🎉' : 'Calculée au paiement'}</span></div>
         <div class="line total"><span>Total</span><span class="prix-actuel">${SB.formatPrix(t.total)}</span></div>
         <a href="checkout.html" class="btn btn-primary btn-block btn-lg" style="margin-top:14px">Passer la commande →</a>
         <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" onclick="SB.cart.vider()">Vider le panier</button>`;
    }
    majBadges();
  }

  function _promoFromDrawer() {
    const inp = document.getElementById('promo-input');
    if (inp && inp.value.trim()) { appliquerPromo(inp.value); render(); }
  }

  /* Réagit aux changements pour re-render + badges */
  SB.bus.on('cart:change', render);
  SB.bus.on('wishlist:change', majBadges);

  SB.cart = {
    ajouter, setQty, incrementer, retirer, vider, count, items,
    sousTotal, totaux, appliquerPromo, retirerPromo, getPromo, remisePromo,
    ouvrir, fermer, render, majBadges, ligneKey, varLabel, _promoFromDrawer
  };

  document.addEventListener('DOMContentLoaded', majBadges);
})();

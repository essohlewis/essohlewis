/* =========================================================================
   app.js — Point d'entrée : initialisation, wiring de l'en-tête, favoris,
   enregistrement des routes et rendu de toutes les vues (SPA).
   ========================================================================= */

(function () {
  "use strict";

  const { DB, UI, Auth, Store, Products, Cart, Orders, Notifications, Router, Seed, Coupons, Messages, Expenses,
    Recent, SearchHist, Alerts, Compare, Loyalty, Questions, SavedSearches, Wishlists, I18n } = window.MP;

  const V = () => document.getElementById("view");
  const SB = () => document.getElementById("sidebar");
  const T = (k) => I18n.t(k); // raccourci de traduction

  /* ============================================================
     Favoris (wishlist) — logique légère persistée dans localStorage
     ============================================================ */
  const Fav = {
    list() {
      const u = Auth.current();
      if (!u) return [];
      return DB.get(DB.KEYS.favorites, {})[u.id] || [];
    },
    has(id) { return Fav.list().includes(id); },
    toggle(id) {
      const u = Auth.current();
      if (!u) { UI.toast("Connectez-vous pour ajouter aux favoris.", "info"); Router.go("#/login"); return null; }
      const map = DB.get(DB.KEYS.favorites, {});
      map[u.id] = map[u.id] || [];
      const i = map[u.id].indexOf(id);
      let added;
      if (i === -1) { map[u.id].push(id); added = true; }
      else { map[u.id].splice(i, 1); added = false; }
      DB.set(DB.KEYS.favorites, map);
      UI.refreshBadges();
      return added;
    },
  };

  /* ============================================================
     Helpers de rendu
     ============================================================ */

  // Minuteries de page (ventes flash…), nettoyées à chaque changement de vue.
  let pageTimers = [];
  function clearPageTimers() { pageTimers.forEach((t) => clearInterval(t)); pageTimers = []; }
  function addPageTimer(fn, ms) { const t = setInterval(fn, ms); pageTimers.push(t); return t; }

  function layout(mainHTML, sidebarHTML) {
    clearPageTimers();
    V().innerHTML = mainHTML;
    SB().innerHTML = sidebarHTML || "";
    // Vide la nav basse vendeur hors des vues back-office (onboarding, client…).
    const sbn = document.getElementById("sellerBottomNav");
    if (sbn) sbn.innerHTML = "";
    renderCompareBar();
  }

  function requireAuth() {
    if (!Auth.isLogged()) {
      UI.toast("Veuillez vous connecter.", "info");
      Router.go("#/login");
      return false;
    }
    return true;
  }

  /** Boutique gérée par l'utilisateur courant (propriétaire ou staff). */
  function sellerStore() { const u = Auth.current(); return u ? Store.managedBy(u.id) : null; }
  /** Rôle de l'utilisateur courant dans sa boutique gérée. */
  function sellerRole() { const s = sellerStore(); const u = Auth.current(); return s && u ? Store.roleFor(s, u.id) : null; }

  function requireVendor() {
    if (!requireAuth()) return false;
    if (!sellerStore()) {
      Router.go("#/seller/store");
      return false;
    }
    return true;
  }

  /** Carte article (HTML). */
  function productCard(p) {
    const store = Store.get(p.storeId);
    const price = Products.effectivePrice(p);
    const hasPromo = Products.promoActive(p);
    const rt = Products.rating(p.id);
    const out = p.stock <= 0;
    const img = UI.safeImg(p.images && p.images[0], p.title);
    const favActive = Fav.has(p.id) ? "active" : "";
    return `
      <article class="product-card" data-href="#/product/${p.id}" tabindex="0" role="link" aria-label="${UI.esc(p.title)} — ${UI.fcfa(price)}">
        <div class="pc-media">
          <img src="${img}" alt="${UI.esc(p.title)}" loading="lazy" />
          <div class="pc-tag">
            ${p.featured ? `<span class="tag featured">★ À la une</span>` : ""}
            ${hasPromo && p.promoUntil && p.promoUntil - Date.now() < 3 * 86400000 && p.promoUntil > Date.now() ? `<span class="tag flash">⚡ Flash</span>` : ""}
            ${hasPromo ? `<span class="tag promo">-${Math.round((1 - price / p.price) * 100)}%</span>` : ""}
            ${p.condition === "occasion" ? `<span class="tag occasion">Occasion</span>` : ""}
            ${out ? `<span class="tag out">Rupture</span>` : ""}
          </div>
          <button class="pc-fav ${favActive}" data-fav="${p.id}" title="Favori" aria-label="Ajouter aux favoris">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-6.7-4.35-9.33-8.36C.9 9.7 2.1 6 5.4 6a4.3 4.3 0 0 1 3.6 2 4.3 4.3 0 0 1 3.6-2c3.3 0 4.5 3.7 2.73 6.64C18.7 16.65 12 21 12 21z"/></svg>
          </button>
        </div>
        <div class="pc-body">
          <div class="pc-store">
            <img class="st-dot" src="${UI.safeImg(store && store.logo, store && store.name)}" alt="" />
            <span>${UI.esc(store ? store.name : "")}</span>
          </div>
          <div class="pc-title">${UI.esc(p.title)}</div>
          <div class="pc-price">
            <span class="price-now">${UI.fcfa(price)}</span>
            ${hasPromo ? `<span class="price-old">${UI.fcfa(p.price)}</span>` : ""}
          </div>
          <div class="pc-meta">
            ${rt.count ? UI.starsHTML(rt.avg) + `<span>(${rt.count})</span>` : `<span class="text-muted">Nouveau</span>`}
            <span>${UI.esc(store ? store.commune : "")}</span>
          </div>
        </div>
      </article>`;
  }

  /** Rend une FAQ (une Q/R par ligne) en accordéon simple. */
  function faqHTML(faq) {
    return String(faq).split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const idx = line.indexOf("?");
      const q = idx >= 0 ? line.slice(0, idx + 1) : line;
      const a = idx >= 0 ? line.slice(idx + 1).trim() : "";
      return `<div class="faq-item"><div class="faq-q">❓ ${UI.esc(q)}</div>${a ? `<div class="faq-a">${UI.esc(a)}</div>` : ""}</div>`;
    }).join("");
  }

  /** Indicateurs de fiabilité d'une boutique (livraison, délai de traitement). */
  function sellerReliability(storeId) {
    const orders = Orders.byStore(storeId);
    if (!orders.length) return { orders: 0, delivRate: 0, avgHours: 0 };
    const delivered = orders.filter((o) => o.status === "livree").length;
    // Délai de traitement : temps entre la réception et la confirmation/expédition.
    let sum = 0, n = 0;
    orders.forEach((o) => {
      const h = o.history || [];
      const start = h[0] ? h[0].at : o.createdAt;
      const conf = h.find((x) => x.status === "confirmee" || x.status === "expediee" || x.status === "livree");
      if (conf) { sum += conf.at - start; n++; }
    });
    return {
      orders: orders.length,
      delivRate: Math.round((delivered / orders.length) * 100),
      avgHours: n ? Math.round(sum / n / 3600000) : 0,
    };
  }

  /** Texte d'estimation des frais de livraison selon la commune de l'acheteur. */
  function deliveryEstimateText(store) {
    const user = Auth.current();
    if (user && user.commune) {
      const fee = Store.deliveryFee(store, user.commune);
      return `${fee > 0 ? UI.fcfa(fee) : "offerte"} vers ${UI.esc(user.commune)}${store.freeShipThreshold ? ` · offerte dès ${UI.fcfa(store.freeShipThreshold)}` : ""}`;
    }
    return `${(store.defaultFee || 0) > 0 ? "à partir de " + UI.fcfa(store.defaultFee) : "offerte"}${store.freeShipThreshold ? ` · offerte dès ${UI.fcfa(store.freeShipThreshold)}` : ""} (selon votre commune)`;
  }

  /** Signalement d'un article (transmis à la modération / admin). */
  function openReportModal(p) {
    const reasons = ["Contenu inapproprié", "Prix trompeur", "Article contrefait", "Article interdit", "Autre"];
    UI.modal({
      title: "Signaler cet article",
      body: `<div class="field"><label>Motif</label><select id="rpReason">${reasons.map((r) => `<option>${r}</option>`).join("")}</select></div>
        <div class="field mt-8"><label>Précision (optionnel)</label><textarea id="rpNote" placeholder="Décrivez le problème…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-danger" id="rpGo">Envoyer le signalement</button>`,
      onMount(m, close) {
        m.querySelector("#rpGo").addEventListener("click", () => {
          const reason = m.querySelector("#rpReason").value + (m.querySelector("#rpNote").value.trim() ? " — " + m.querySelector("#rpNote").value.trim() : "");
          // Notifie les administrateurs.
          DB.all(DB.KEYS.users).filter((u) => u.role === "admin").forEach((a) => Notifications.push(a.id, { type: "info", message: `⚑ Article signalé : « ${p.title} » (${reason}).`, link: "#/product/" + p.id }));
          UI.toast("Merci, votre signalement a été transmis à la modération.", "success"); close();
        });
      },
    });
  }

  function openPriceAlertModal(p) {
    const cur = Products.effectivePrice(p);
    UI.modal({
      title: "Alerte prix",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Prix actuel : <strong>${UI.fcfa(cur)}</strong>. Nous vous préviendrons dès que le prix descend à ou sous votre seuil.</p>
        <div class="field"><label>Me prévenir si le prix ≤ (FCFA)</label><input type="number" id="alPrice" min="1" value="${Math.round(cur * 0.9)}" /></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="alGo">Créer l'alerte</button>`,
      onMount(m, close) {
        m.querySelector("#alGo").addEventListener("click", () => {
          const target = Number(m.querySelector("#alPrice").value);
          if (!(target > 0)) { UI.toast("Montant invalide.", "error"); return; }
          Alerts.add(p.id, "price", target);
          UI.toast("🔔 Alerte prix créée.", "success"); close();
        });
      },
    });
  }

  /** Articles similaires (même boutique/catégorie), hors l'article courant. */
  function similarProducts(product, limit) {
    const pool = Products.published().filter((p) => p.id !== product.id);
    const sameStore = pool.filter((p) => p.storeId === product.storeId);
    const sameCat = pool.filter((p) => p.storeId !== product.storeId && p.category === product.category);
    return sameStore.concat(sameCat).slice(0, limit || 6);
  }

  function gridHTML(list, emptyMsg) {
    if (!list.length) {
      return emptyState("🔍", "Aucun article trouvé", emptyMsg || "Essayez de modifier vos filtres ou votre recherche.");
    }
    return `<div class="grid">${list.map(productCard).join("")}</div>`;
  }

  function emptyState(icon, title, text, actionHTML) {
    return `<div class="empty-state">
      <div class="empty-ico">${icon}</div>
      <h3>${UI.esc(title)}</h3>
      <p>${UI.esc(text)}</p>
      ${actionHTML || ""}
    </div>`;
  }

  function skeletonGrid(n) {
    let s = "";
    for (let i = 0; i < (n || 8); i++) {
      s += `<div class="sk-card"><div class="skeleton sk-media"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div>`;
    }
    return `<div class="grid">${s}</div>`;
  }

  /** Construit une URL de profil réseau social sûre (https). */
  function socialUrl(type, val) {
    val = String(val || "").trim();
    if (!val) return "";
    if (/^https?:\/\//i.test(val)) return val; // lien complet déjà fourni
    const handle = val.replace(/^@/, "").replace(/\s+/g, "");
    const h = encodeURIComponent(handle);
    if (type === "instagram") return "https://instagram.com/" + h;
    if (type === "facebook") return "https://facebook.com/" + h;
    if (type === "tiktok") return "https://tiktok.com/@" + h;
    return "";
  }

  // Icônes des réseaux sociaux (monochromes, colorées via --sc).
  const SOCIAL_SVG = {
    instagram: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zM18.8 5a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 18.8 5z'/></svg>",
    facebook: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z'/></svg>",
    tiktok: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M16.6 5.8a4.3 4.3 0 0 1-2.6-3.8h-3v13.2a2.4 2.4 0 1 1-2.4-2.4c.2 0 .5 0 .7.1v-3a5.4 5.4 0 1 0 4.7 5.4V9.3a7.2 7.2 0 0 0 4.2 1.3v-3a4.3 4.3 0 0 1-1.6-1.8z'/></svg>",
  };
  const SOCIAL_COLOR = { instagram: "#E1306C", facebook: "#1877F2", tiktok: "#ee1d52" };

  /** Rangée de boutons réseaux sociaux cliquables (ouvrent l'app/plateforme). */
  function socialLinksHTML(store) {
    const s = store.socials || {};
    const links = ["instagram", "facebook", "tiktok"].map((k) => {
      const url = socialUrl(k, s[k]);
      if (!url) return "";
      const label = k.charAt(0).toUpperCase() + k.slice(1);
      return `<a class="social-btn" href="${UI.esc(url)}" target="_blank" rel="noopener noreferrer" style="--sc:${SOCIAL_COLOR[k]}" title="Ouvrir ${label}">${SOCIAL_SVG[k]}<span>${label}</span></a>`;
    }).filter(Boolean).join("");
    return links ? `<div class="social-row">${links}</div>` : "";
  }

  /** Génère une affiche promotionnelle (canvas) téléchargeable + partage. */
  function generateProductPoster(p) {
    const store = Store.get(p.storeId);
    const accent = /^#[0-9a-fA-F]{3,8}$/.test(store.themeColor || "") ? store.themeColor : "#f97316";
    const price = Products.effectivePrice(p);
    const promo = Products.promoActive(p);
    const W = 1080, H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function draw(img) {
      // Fond
      ctx.fillStyle = "#0e1117"; ctx.fillRect(0, 0, W, H);
      // Bandeau haut (couleur boutique)
      ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 150);
      ctx.fillStyle = "#fff"; ctx.font = "bold 52px Segoe UI, Arial"; ctx.textBaseline = "middle";
      ctx.fillText(store.name.slice(0, 22), 60, 75);
      ctx.font = "500 30px Segoe UI, Arial"; ctx.globalAlpha = .9;
      ctx.fillText("📍 " + store.commune, 60, 118); ctx.globalAlpha = 1;
      // Image produit
      const iy = 190, ih = 720;
      ctx.save(); roundRect(60, iy, W - 120, ih, 36); ctx.clip();
      if (img) {
        const ratio = Math.max((W - 120) / img.width, ih / img.height);
        const dw = img.width * ratio, dh = img.height * ratio;
        ctx.drawImage(img, 60 + (W - 120 - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      } else { ctx.fillStyle = accent; ctx.fillRect(60, iy, W - 120, ih); }
      ctx.restore();
      // Badge promo
      if (promo) { ctx.fillStyle = "#e11d48"; roundRect(80, iy + 24, 190, 66, 33); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 40px Segoe UI, Arial"; ctx.textAlign = "center"; ctx.fillText("-" + Math.round((1 - price / p.price) * 100) + "%", 175, iy + 58); ctx.textAlign = "left"; }
      // Titre (2 lignes max)
      ctx.fillStyle = "#fff"; ctx.font = "bold 54px Segoe UI, Arial";
      const words = p.title.split(" "); let line = "", y = 990; const lines = [];
      words.forEach((w) => { if (ctx.measureText(line + w).width > W - 140) { lines.push(line.trim()); line = w + " "; } else line += w + " "; });
      lines.push(line.trim());
      lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 60, y + i * 62));
      // Prix
      y += lines.slice(0, 2).length * 62 + 20;
      ctx.fillStyle = accent; ctx.font = "bold 88px Segoe UI, Arial";
      ctx.fillText(UI.fcfa(price), 60, y);
      if (promo) { const pw = ctx.measureText(UI.fcfa(price)).width; ctx.fillStyle = "#8a909c"; ctx.font = "40px Segoe UI, Arial"; ctx.fillText(UI.fcfa(p.price), 80 + pw, y + 4); ctx.beginPath(); ctx.strokeStyle = "#8a909c"; ctx.lineWidth = 3; ctx.moveTo(80 + pw, y + 2); ctx.lineTo(80 + pw + ctx.measureText(UI.fcfa(p.price)).width, y + 2); ctx.stroke(); }
      // Pied
      ctx.fillStyle = "#161b22"; roundRect(0, H - 150, W, 150, 0); ctx.fill();
      ctx.fillStyle = "#e8ebf0"; ctx.font = "500 34px Segoe UI, Arial";
      ctx.fillText("💵 Paiement à la livraison" + (store.whatsapp ? "  ·  📞 " + store.whatsapp : ""), 60, H - 95);
      ctx.fillStyle = accent; ctx.font = "bold 30px Segoe UI, Arial";
      ctx.fillText("🛒 Marché CI", 60, H - 48);

      const dataUrl = canvas.toDataURL("image/png");
      showPosterModal(dataUrl, p, store);
    }

    const src = (p.images && p.images[0]) || "";
    if (/^data:image\/|^https?:\/\//.test(src)) {
      const img = new Image();
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = src;
    } else draw(null);
  }

  function showPosterModal(dataUrl, p, store) {
    const waText = `🛍️ ${p.title}\n💰 ${UI.fcfa(Products.effectivePrice(p))}\n🏪 ${store.name} — 📍 ${store.commune}\n💵 Paiement à la livraison sur Marché CI.`;
    UI.modal({
      title: "Affiche promotionnelle",
      body: `<div style="text-align:center"><img src="${dataUrl}" alt="Affiche" style="max-width:100%;border-radius:var(--r);box-shadow:var(--shadow)" />
        <p class="text-muted" style="font-size:12.5px;margin:12px 0 0">Téléchargez l'image puis publiez-la sur WhatsApp/statut, Facebook ou Instagram.</p></div>`,
      footer: `<a class="btn btn-primary" id="dlPoster" download="affiche-${slugify(p.title) || "article"}.png" href="${dataUrl}">${SICON.download} Télécharger</a>
        <button class="btn wa-btn" id="waPoster">${SICON.wa} Texte WhatsApp</button>`,
      onMount(m) { m.querySelector("#waPoster").addEventListener("click", () => waShare(waText)); },
    });
  }

  /** Visionneuse d'images plein écran (galerie) avec navigation. */
  function openLightbox(images, start) {
    if (!images || !images.length) return;
    let idx = Math.max(0, Math.min(start || 0, images.length - 1));
    const root = document.createElement("div");
    root.className = "lightbox";
    root.innerHTML =
      `<button class="lb-close" aria-label="Fermer">✕</button>` +
      (images.length > 1 ? `<button class="lb-nav lb-prev" aria-label="Précédent">‹</button><button class="lb-nav lb-next" aria-label="Suivant">›</button>` : "") +
      `<img class="lb-img" alt="" /><div class="lb-count"></div>`;
    document.body.appendChild(root);
    document.body.style.overflow = "hidden";
    const img = root.querySelector(".lb-img");
    const count = root.querySelector(".lb-count");
    function render() { img.src = images[idx]; if (count) count.textContent = idx + 1 + " / " + images.length; }
    function close() { root.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); }
    function prev() { idx = (idx - 1 + images.length) % images.length; render(); }
    function next() { idx = (idx + 1) % images.length; render(); }
    function onKey(e) { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); }
    root.querySelector(".lb-close").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    const p = root.querySelector(".lb-prev"), nx = root.querySelector(".lb-next");
    if (p) p.addEventListener("click", prev);
    if (nx) nx.addEventListener("click", next);
    document.addEventListener("keydown", onKey);
    render();
  }

  /** Grille complète de la galerie (modale) : toutes les photos, chacune ouvrant la visionneuse. */
  function openGalleryModal(images, storeName) {
    if (!images || !images.length) return;
    UI.modal({
      title: `🖼️ Galerie — ${storeName} (${images.length})`,
      body: `<div class="gallery-modal-grid">${images.map((src, i) => `<button class="gal-item" data-gm="${i}"><img src="${src}" alt="Photo ${i + 1}" loading="lazy" /></button>`).join("")}</div>`,
      footer: `<button class="btn btn-ghost btn-block" data-close>Fermer</button>`,
      onMount(m, close) {
        m.querySelectorAll("[data-gm]").forEach((b) =>
          b.addEventListener("click", () => { close(); openLightbox(images, Number(b.getAttribute("data-gm"))); })
        );
      },
    });
  }

  /* ============================================================
     VUE : Accueil (fil de toutes les boutiques)
     ============================================================ */
  function viewHome(params) {
    const q = params.query || {};
    const user = Auth.current();
    const filters = {
      category: q.cat || "",
      commune: q.commune || "",
      storeId: q.store || "",
      minPrice: q.min || "",
      maxPrice: q.max || "",
      sort: q.sort || "recent",
      promoOnly: q.promo === "1",
      inStock: q.stock === "1",
      freeShip: q.free === "1",
      condition: q.cond || "",
      minRating: q.rating || "",
    };
    const hasFilters = !!(filters.category || filters.commune || filters.storeId || filters.minPrice || filters.maxPrice ||
      filters.promoOnly || filters.inStock || filters.freeShip || filters.condition || filters.minRating || q.tab === "suivis");

    // Sections découverte (uniquement en vue par défaut).
    let sections = "";
    if (!hasFilters) {
      const recent = user ? Recent.list().slice(0, 10) : [];
      if (recent.length) sections += `<div class="section-title">${T("home.recentlyViewed")}</div><div class="scroll-row">${recent.map(productCard).join("")}</div>`;
      const reco = recommendedProducts(8);
      if (reco.length) sections += `<div class="section-title">${T("home.recommended")}</div><div class="scroll-row">${reco.map(productCard).join("")}</div>`;
    }

    // Onglet « Suivis » (boutiques abonnées).
    let feedList;
    if (q.tab === "suivis" && user) {
      const subs = DB.get(DB.KEYS.subscriptions, {})[user.id] || [];
      feedList = Products.published().filter((p) => subs.includes(p.storeId)).sort((a, b) => b.createdAt - a.createdAt);
    } else {
      feedList = Products.search(filters);
      // Tri « près de chez moi » : les articles des boutiques de ma commune d'abord.
      if (filters.sort === "nearby" && user && user.commune) {
        const storeMap = {};
        Store.all().forEach((s) => { storeMap[s.id] = s; });
        feedList = feedList.slice().sort((a, b) => {
          const ca = storeMap[a.storeId] && storeMap[a.storeId].commune === user.commune ? 0 : 1;
          const cb = storeMap[b.storeId] && storeMap[b.storeId].commune === user.commune ? 0 : 1;
          return ca - cb || b.createdAt - a.createdAt;
        });
      }
    }

    const onboard = (user && !(user.prefCategories && user.prefCategories.length) && !hasFilters)
      ? `<div class="card card-pad" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="flex:1"><strong>👋 Personnalisez votre fil</strong><div class="text-muted" style="font-size:13px">Choisissez vos catégories préférées pour des recommandations sur mesure.</div></div>
          <button class="btn btn-primary btn-sm" id="onboardBtn">Choisir mes catégories</button></div>` : "";

    const tabs = `<div class="filter-bar" style="margin-bottom:6px">
      <a href="#/" class="chip ${q.tab !== "suivis" ? "active" : ""}">${T("home.tabForYou")}</a>
      ${user ? `<a href="#/?tab=suivis" class="chip ${q.tab === "suivis" ? "active" : ""}">${T("home.tabFollowed")}</a>` : ""}
      <a href="#/deals" class="chip">${T("home.deals")}</a>
      <a href="#/stores" class="chip">${T("home.stores")}</a>
      ${user ? `<a href="#/activity" class="chip">${T("home.activity")}</a>` : ""}
      ${Compare.count() ? `<a href="#/compare" class="chip">⚖️ Comparer (${Compare.count()})</a>` : ""}
    </div>`;

    layout(
      `<div class="hero-banner"><h1>${T("home.heroTitle")}</h1>
        <p>${T("home.heroSub")}</p>
        <div class="hero-badges">
          <span class="hero-pill">${T("home.pillDelivery")}</span>
          <span class="hero-pill">${T("home.pillCod")}</span>
          <span class="hero-pill">🏪 ${Store.all().length} ${T("home.stores").replace(/^🏪\s*/, "").toLowerCase()}</span>
        </div></div>` +
      onboard + tabs + sections +
      `<div class="section-title">${q.tab === "suivis" ? T("home.newFromFollowed") : hasFilters ? T("home.results") : T("home.discover")}</div>` +
      categoryChips(filters.category) + skeletonGrid(8),
      sidebarFilters(filters)
    );

    setTimeout(() => {
      // Le squelette est le dernier .grid du DOM (les sections utilisent .scroll-row).
      const grids = V().querySelectorAll(".grid");
      const target = grids[grids.length - 1];
      if (target) target.outerHTML = gridHTML(feedList, q.tab === "suivis" ? "Abonnez-vous à des boutiques pour voir leurs nouveautés ici." : "Aucun article ne correspond à ces critères.");
      wireSidebar(filters);
      wireCategoryChips();
      const ob = document.getElementById("onboardBtn");
      if (ob) ob.addEventListener("click", openCategoryPrefs);
    }, 160);
  }

  /** Recommandations basées sur les catégories des favoris + articles vus. */
  function recommendedProducts(limit) {
    const user = Auth.current();
    const catScore = {};
    if (user) {
      (DB.get(DB.KEYS.favorites, {})[user.id] || []).forEach((id) => { const p = Products.get(id); if (p) catScore[p.category] = (catScore[p.category] || 0) + 2; });
      Recent.list().forEach((p) => { catScore[p.category] = (catScore[p.category] || 0) + 1; });
    }
    const seen = new Set((user ? Recent.list() : []).map((p) => p.id));
    let pool = Products.published().filter((p) => !seen.has(p.id));
    const topCat = Object.keys(catScore).sort((a, b) => catScore[b] - catScore[a])[0];
    if (topCat) pool.sort((a, b) => (b.category === topCat ? 1 : 0) - (a.category === topCat ? 1 : 0) || (b.views || 0) - (a.views || 0));
    else pool.sort((a, b) => (b.views || 0) - (a.views || 0));
    return pool.slice(0, limit || 8);
  }

  function openCategoryPrefs() {
    const user = Auth.current();
    const cur = (user && user.prefCategories) || [];
    UI.modal({
      title: "Vos catégories préférées",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Sélectionnez ce qui vous intéresse.</p>
        <div class="zone-chips">${UI.CATEGORIES.map((c) => `<span class="zone-chip ${cur.includes(c.id) ? "on" : ""}" data-cat="${c.id}">${c.icon} ${c.label}</span>`).join("")}</div>`,
      footer: `<button class="btn btn-ghost" data-close>Plus tard</button><button class="btn btn-primary" id="prefGo">Enregistrer</button>`,
      onMount(m, close) {
        m.querySelectorAll(".zone-chip").forEach((c) => c.addEventListener("click", () => c.classList.toggle("on")));
        m.querySelector("#prefGo").addEventListener("click", () => {
          const picked = Array.from(m.querySelectorAll(".zone-chip.on")).map((c) => c.getAttribute("data-cat"));
          Auth.updateProfile({ prefCategories: picked });
          UI.toast("Préférences enregistrées ✓", "success"); close(); Router.resolve();
        });
      },
    });
  }

  function categoryChips(active) {
    const chips = UI.CATEGORIES.map(
      (c) => `<button class="chip ${active === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon} ${c.label}</button>`
    ).join("");
    return `<div class="filter-bar">
      <button class="chip ${!active ? "active" : ""}" data-cat="">✨ Tout</button>${chips}
    </div>`;
  }

  function wireCategoryChips() {
    V().querySelectorAll(".chip[data-cat]").forEach((c) =>
      c.addEventListener("click", () => {
        const cat = c.getAttribute("data-cat");
        Router.go(cat ? "#/category/" + cat : "#/");
      })
    );
  }

  /* ============================================================
     VUE : Page catégorie dédiée (fil d'Ariane + sous-filtres)
     ============================================================ */
  function viewCategory(params) {
    const cat = UI.CATEGORIES.find((c) => c.id === params.id);
    if (!cat) { layout(emptyState("🧭", "Catégorie introuvable", "Cette catégorie n'existe pas.", `<a href="#/" class="btn btn-primary">Retour à l'accueil</a>`)); return; }
    const q = params.query || {};
    const filters = {
      category: cat.id,
      sort: q.sort || "recent",
      promoOnly: q.promo === "1",
      inStock: q.stock === "1",
    };
    const list = Products.search(filters);
    // Répartition par sous-catégorie implicite : boutiques présentes dans cette catégorie.
    const storeCount = new Set(list.map((p) => p.storeId)).size;
    const sortOpts = [["recent", "Plus récents"], ["popular", "Populaires"], ["rating", "Mieux notés"], ["discount", "Meilleures promos"], ["price_asc", "Prix croissant"], ["price_desc", "Prix décroissant"]];
    layout(`
      <nav class="breadcrumb"><a href="#/">Accueil</a> › <span>${UI.esc(cat.label)}</span></nav>
      <div class="category-hero">
        <div class="category-hero-icon">${cat.icon}</div>
        <div><h1>${UI.esc(cat.label)}</h1>
          <p class="text-muted" style="margin:2px 0 0">${list.length} article(s) · ${storeCount} boutique(s)</p></div>
      </div>
      <div class="filter-bar" style="align-items:center">
        <label class="inline-field">Trier
          <select id="catSort">${sortOpts.map(([v, l]) => `<option value="${v}" ${filters.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </label>
        <button class="chip ${filters.promoOnly ? "active" : ""}" id="catPromo">🔥 En promo</button>
        <button class="chip ${filters.inStock ? "active" : ""}" id="catStock">✅ En stock</button>
        <a href="#/stores" class="chip">🏪 Voir les boutiques</a>
      </div>
      ${gridHTML(list, "Aucun article dans cette catégorie pour le moment.")}`);

    const rebuild = () => {
      const p = new URLSearchParams();
      const s = document.getElementById("catSort").value;
      if (s && s !== "recent") p.set("sort", s);
      if (document.getElementById("catPromo").classList.contains("active")) p.set("promo", "1");
      if (document.getElementById("catStock").classList.contains("active")) p.set("stock", "1");
      const qs = p.toString();
      Router.go("#/category/" + cat.id + (qs ? "?" + qs : ""));
    };
    document.getElementById("catSort").addEventListener("change", rebuild);
    document.getElementById("catPromo").addEventListener("click", () => { document.getElementById("catPromo").classList.toggle("active"); rebuild(); });
    document.getElementById("catStock").addEventListener("click", () => { document.getElementById("catStock").classList.toggle("active"); rebuild(); });
  }

  function sidebarFilters(f) {
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${f.commune === c ? "selected" : ""}>${c}</option>`).join("");
    const storeOpts = Store.all().map((s) => `<option value="${s.id}" ${f.storeId === s.id ? "selected" : ""}>${UI.esc(s.name)}</option>`).join("");
    return `
      <div class="sidebar-card">
        <h4>Filtres</h4>
        <div class="filter-group">
          <label class="field"><span style="font-weight:700;font-size:13px">Trier par</span>
            <select id="fSort">
              <option value="recent" ${f.sort === "recent" ? "selected" : ""}>Plus récents</option>
              <option value="popular" ${f.sort === "popular" ? "selected" : ""}>Populaires</option>
              <option value="rating" ${f.sort === "rating" ? "selected" : ""}>Mieux notés</option>
              <option value="discount" ${f.sort === "discount" ? "selected" : ""}>Meilleures promos</option>
              <option value="price_asc" ${f.sort === "price_asc" ? "selected" : ""}>Prix croissant</option>
              <option value="price_desc" ${f.sort === "price_desc" ? "selected" : ""}>Prix décroissant</option>
              ${Auth.isLogged() && Auth.current().commune ? `<option value="nearby" ${f.sort === "nearby" ? "selected" : ""}>📍 Près de chez moi</option>` : ""}
            </select>
          </label>
        </div>
        <div class="filter-group">
          <span style="font-weight:700;font-size:13px;display:block;margin-bottom:8px">Options</span>
          <label class="radio-item"><input type="checkbox" id="fPromo" ${f.promoOnly ? "checked" : ""}/> En promotion</label>
          <label class="radio-item"><input type="checkbox" id="fFree" ${f.freeShip ? "checked" : ""}/> Livraison offerte</label>
          <label class="radio-item"><input type="checkbox" id="fStock" ${f.inStock ? "checked" : ""}/> En stock</label>
        </div>
        <div class="filter-group">
          <label class="field"><span style="font-weight:700;font-size:13px">État</span>
            <select id="fCond"><option value="">Tous</option><option value="neuf" ${f.condition === "neuf" ? "selected" : ""}>Neuf</option><option value="occasion" ${f.condition === "occasion" ? "selected" : ""}>Occasion</option></select>
          </label>
        </div>
        <div class="filter-group">
          <label class="field"><span style="font-weight:700;font-size:13px">Note minimale</span>
            <select id="fRating"><option value="">Toutes</option><option value="4" ${f.minRating == 4 ? "selected" : ""}>★★★★ et +</option><option value="3" ${f.minRating == 3 ? "selected" : ""}>★★★ et +</option></select>
          </label>
        </div>
        <div class="filter-group">
          <label class="field"><span style="font-weight:700;font-size:13px">Commune</span>
            <select id="fCommune"><option value="">Toutes les communes</option>${communeOpts}</select>
          </label>
        </div>
        <div class="filter-group">
          <label class="field"><span style="font-weight:700;font-size:13px">Boutique</span>
            <select id="fStore"><option value="">Toutes les boutiques</option>${storeOpts}</select>
          </label>
        </div>
        <div class="filter-group">
          <span style="font-weight:700;font-size:13px;display:block;margin-bottom:8px">Prix (FCFA)</span>
          <div class="price-range">
            <input type="number" id="fMin" placeholder="Min" value="${UI.esc(f.minPrice)}" min="0" />
            <span>—</span>
            <input type="number" id="fMax" placeholder="Max" value="${UI.esc(f.maxPrice)}" min="0" />
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="fApply">Appliquer</button>
        <button class="btn btn-ghost btn-block mt-8" id="fReset">Réinitialiser</button>
        ${Auth.isLogged() ? `<button class="btn btn-outline btn-block mt-8" id="fSaveSearch">🔔 Créer une alerte de recherche</button>` : ""}
      </div>`;
  }

  function wireSidebar(f) {
    const sb = SB();
    if (!sb) return;
    const apply = () => {
      const q = new URLSearchParams();
      if (f.category) q.set("cat", f.category);
      const commune = sb.querySelector("#fCommune").value;
      const store = sb.querySelector("#fStore").value;
      const sort = sb.querySelector("#fSort").value;
      const min = sb.querySelector("#fMin").value;
      const max = sb.querySelector("#fMax").value;
      const cond = sb.querySelector("#fCond").value;
      const rating = sb.querySelector("#fRating").value;
      if (commune) q.set("commune", commune);
      if (store) q.set("store", store);
      if (sort && sort !== "recent") q.set("sort", sort);
      if (min) q.set("min", min);
      if (max) q.set("max", max);
      if (cond) q.set("cond", cond);
      if (rating) q.set("rating", rating);
      if (sb.querySelector("#fPromo").checked) q.set("promo", "1");
      if (sb.querySelector("#fFree").checked) q.set("free", "1");
      if (sb.querySelector("#fStock").checked) q.set("stock", "1");
      const qs = q.toString();
      Router.go("#/" + (qs ? "?" + qs : ""));
    };
    const applyBtn = sb.querySelector("#fApply");
    if (applyBtn) applyBtn.addEventListener("click", apply);
    const resetBtn = sb.querySelector("#fReset");
    if (resetBtn) resetBtn.addEventListener("click", () => Router.go("#/"));
    const sortSel = sb.querySelector("#fSort");
    if (sortSel) sortSel.addEventListener("change", apply);
    const saveBtn = sb.querySelector("#fSaveSearch");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const cat = UI.CATEGORIES.find((c) => c.id === f.category);
      const parts = [];
      if (cat) parts.push(cat.label);
      const commune = sb.querySelector("#fCommune").value;
      const max = sb.querySelector("#fMax").value;
      if (commune) parts.push(commune);
      if (max) parts.push("≤ " + UI.fcfa(max));
      const defLabel = parts.length ? parts.join(" · ") : "Nouveaux articles";
      UI.modal({
        title: "🔔 Alerte de recherche",
        body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Vous serez notifié dès qu'un nouvel article correspondant est publié.</p>
          <div class="field"><label>Nom de l'alerte</label><input type="text" id="ssLabel" value="${UI.esc(defLabel)}" /></div>`,
        footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="ssGo">Créer l'alerte</button>`,
        onMount(m, close) {
          m.querySelector("#ssGo").addEventListener("click", () => {
            const label = m.querySelector("#ssLabel").value.trim() || defLabel;
            const filters = {};
            if (f.category) filters.category = f.category;
            if (max) filters.maxPrice = max;
            const r = SavedSearches.add(filters, label);
            if (!r.ok) { UI.toast(r.error, "error"); return; }
            UI.toast("🔔 Alerte de recherche créée.", "success"); close();
          });
        },
      });
    });
  }

  /* ============================================================
     VUE : Recherche
     ============================================================ */
  function viewSearch(params) {
    const q = (params.query && params.query.q) || "";
    const filters = { q, sort: "recent" };
    const list = q ? Products.search(filters) : Products.published();
    if (q) SearchHist.add(q);

    // Bloc « aucun résultat » intelligent : correction, catégorie proche, alternatives.
    let noResultsHTML = "";
    if (q && !list.length) {
      const suggestion = closestSearchTerm(q);
      const catGuess = closestCategory(q);
      const popular = Array.from(new Set(Products.published().map((p) => p.category)))
        .map((id) => UI.CATEGORIES.find((c) => c.id === id)).filter(Boolean).slice(0, 6);
      const alternatives = recommendedProducts(8);
      noResultsHTML = `
        <div class="no-results">
          <div class="no-results-emoji">🔍</div>
          <h3>Aucun résultat pour « ${UI.esc(q)} »</h3>
          ${suggestion ? `<p>Vouliez-vous dire <button class="btn-link-inline" data-didyoumean="${UI.esc(suggestion)}">« ${UI.esc(suggestion)} »</button> ?</p>` : ""}
          ${catGuess ? `<p>Explorez la catégorie <a href="#/category/${catGuess.id}" class="chip">${catGuess.icon} ${catGuess.label}</a></p>` : ""}
          <div class="no-results-tips">
            <strong>Conseils :</strong> vérifiez l'orthographe, utilisez des mots plus généraux, ou parcourez les catégories.
          </div>
          <div class="filter-bar" style="justify-content:center;margin-top:10px">${popular.map((c) => `<a href="#/category/${c.id}" class="chip">${c.icon} ${c.label}</a>`).join("")}</div>
        </div>
        ${alternatives.length ? `<div class="section-title">✨ Vous pourriez aussi aimer</div><div class="scroll-row">${alternatives.map(productCard).join("")}</div>` : ""}`;
    }

    layout(
      `<div class="page-head"><div>
        <div class="page-title">${q ? T("search.results") : T("search.explore")}</div>
        <div class="page-sub">${q ? `${list.length} résultat(s) pour « ${UI.esc(q)} »` : T("search.exploreSub")}</div>
      </div></div>
      <form id="searchForm" style="margin-bottom:18px">
        <div class="field"><input type="search" id="searchQ" placeholder="Que recherchez-vous ?" value="${UI.esc(q)}" /></div>
      </form>
      ${categoryChips("")}
      ${list.length ? gridHTML(list) : (q ? noResultsHTML : gridHTML(list))}`
    );
    wireCategoryChips();
    const form = document.getElementById("searchForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = document.getElementById("searchQ").value.trim();
      Router.go("#/search?q=" + encodeURIComponent(val));
    });
    V().querySelectorAll("[data-didyoumean]").forEach((b) => b.addEventListener("click", () => Router.go("#/search?q=" + encodeURIComponent(b.getAttribute("data-didyoumean")))));
  }

  /** Distance de Levenshtein (tolérance aux fautes de frappe). */
  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /** Terme le plus proche parmi les titres/mots des articles publiés. */
  function closestSearchTerm(q) {
    q = String(q || "").trim().toLowerCase();
    if (q.length < 3) return null;
    const words = new Set();
    Products.published().forEach((p) => (p.title || "").toLowerCase().split(/[^a-zà-ÿ0-9]+/i).forEach((w) => { if (w.length >= 3) words.add(w); }));
    UI.CATEGORIES.forEach((c) => words.add(c.label.toLowerCase()));
    let best = null, bestD = Infinity;
    words.forEach((w) => { const d = levenshtein(q, w); if (d < bestD) { bestD = d; best = w; } });
    // Retenu seulement si suffisamment proche et pas identique.
    return best && best !== q && bestD > 0 && bestD <= Math.max(1, Math.floor(q.length / 3)) ? best : null;
  }

  /** Catégorie la plus proche du terme recherché. */
  function closestCategory(q) {
    q = String(q || "").trim().toLowerCase();
    let best = null, bestD = Infinity;
    UI.CATEGORIES.forEach((c) => {
      c.label.toLowerCase().split(/\s*&\s*|\s+/).forEach((w) => { const d = levenshtein(q, w); if (d < bestD) { bestD = d; best = c; } });
    });
    return best && bestD <= Math.max(2, Math.floor(q.length / 2)) ? best : null;
  }

  /* ============================================================
     VUE : Bons plans (promos + ventes flash)
     ============================================================ */
  function viewDeals() {
    const now = Date.now();
    const promos = Products.search({ promoOnly: true, sort: "discount" });
    const flash = promos.filter((p) => p.promoUntil && p.promoUntil > now && p.promoUntil - now < 3 * 86400000);
    const others = promos.filter((p) => !flash.includes(p));
    layout(`
      <div class="hero-banner" style="background:linear-gradient(120deg,#b91c1c,#f97316)"><h1>🔥 Bons plans du moment</h1>
        <p>Promotions et ventes flash de toutes les boutiques. Payez à la livraison.</p>
        <div class="hero-badges"><span class="hero-pill">${promos.length} article(s) en promo</span>${flash.length ? `<span class="hero-pill">⚡ ${flash.length} vente(s) flash</span>` : ""}</div></div>
      ${flash.length ? `<div class="section-title">⚡ Ventes flash — dépêchez-vous !</div>${gridHTML(flash)}` : ""}
      <div class="section-title">Toutes les promotions</div>
      ${gridHTML(others.length ? others : promos, "Aucune promotion en cours pour le moment.")}`);
  }

  /* ============================================================
     VUE : Comparateur d'articles
     ============================================================ */
  function viewCompare() {
    const items = Compare.list().map((id) => Products.get(id)).filter((p) => p);
    if (!items.length) { layout(emptyState("⚖️", "Comparateur vide", "Ajoutez des articles à comparer depuis leur fiche (bouton « Comparer »).", `<a href="#/" class="btn btn-primary">Explorer les articles</a>`)); return; }
    const rows = [
      ["Prix", (p) => `<strong style="color:var(--brand)">${UI.fcfa(Products.effectivePrice(p))}</strong>`],
      ["Prix normal", (p) => Products.promoActive(p) ? `<span style="text-decoration:line-through;color:var(--text-3)">${UI.fcfa(p.price)}</span>` : "—"],
      ["Boutique", (p) => { const s = Store.get(p.storeId); return s ? `<a href="#/store/${s.id}">${UI.esc(s.name)}</a>` : "—"; }],
      ["Commune", (p) => { const s = Store.get(p.storeId); return s ? UI.esc(s.commune) : "—"; }],
      ["Note", (p) => { const r = Products.rating(p.id); return r.count ? UI.starsHTML(r.avg) + ` (${r.count})` : "—"; }],
      ["État", (p) => p.condition === "occasion" ? "Occasion" : "Neuf"],
      ["Stock", (p) => p.stock > 0 ? p.stock + " dispo." : `<span class="status annulee">Rupture</span>`],
    ];
    layout(`
      <div class="page-head"><div><div class="page-title">⚖️ Comparateur</div><div class="page-sub">${items.length} article(s)</div></div>
        <button class="btn btn-ghost" id="clearCompare">Vider</button></div>
      <div class="table-wrap"><table class="cmp-table">
        <thead><tr><th></th>${items.map((p) => `<th><a href="#/product/${p.id}"><img src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/><div class="cmp-title">${UI.esc(p.title)}</div></a><button class="btn btn-ghost btn-sm mt-8" data-uncmp="${p.id}">Retirer</button></th>`).join("")}</tr></thead>
        <tbody>${rows.map(([label, fn]) => `<tr><td class="cmp-label">${label}</td>${items.map((p) => `<td>${fn(p)}</td>`).join("")}</tr>`).join("")}
          <tr><td></td>${items.map((p) => `<td>${p.stock > 0 ? `<button class="btn btn-primary btn-sm" data-addcmp="${p.id}">+ Panier</button>` : "—"}</td>`).join("")}</tr>
        </tbody></table></div>`);
    document.getElementById("clearCompare").addEventListener("click", () => { Compare.clear(); Router.resolve(); renderCompareBar(); });
    V().querySelectorAll("[data-uncmp]").forEach((b) => b.addEventListener("click", () => { Compare.toggle(b.getAttribute("data-uncmp")); Router.resolve(); renderCompareBar(); }));
    V().querySelectorAll("[data-addcmp]").forEach((b) => b.addEventListener("click", () => { const r = Cart.add(b.getAttribute("data-addcmp"), 1, {}); UI.toast(r.ok ? "Ajouté au panier ✓" : r.error, r.ok ? "success" : "error"); }));
  }

  /* ============================================================
     VUE : Centre d'aide / FAQ globale
     ============================================================ */
  function viewHelp() {
    const faqs = [
      ["Comment passer une commande ?", "Ajoutez des articles au panier, puis validez en renseignant vos coordonnées de livraison. Vous payez en espèces à la réception."],
      ["Comment se fait le paiement ?", "Uniquement à la livraison, en espèces (cash on delivery). Aucun paiement en ligne n'est demandé."],
      ["Quels sont les délais de livraison ?", "Ils dépendent de chaque vendeur et de votre commune. Le vendeur vous contacte pour convenir d'un créneau."],
      ["Puis-je annuler une commande ?", "Oui, tant qu'elle n'est pas livrée, depuis « Mes commandes » en indiquant un motif."],
      ["Comment contacter un vendeur ?", "Depuis une fiche article, cliquez sur « Poser une question au vendeur » ou utilisez son bouton WhatsApp."],
      ["Comment suivre ma commande ?", "Dans « Mes commandes », une barre d'étapes indique l'avancement (reçue, confirmée, expédiée, livrée)."],
      ["Comment utiliser un code promo ?", "Saisissez-le au moment du paiement, dans le champ « Code promo » du récapitulatif."],
    ];
    layout(`
      <div class="page-head"><div><div class="page-title">Centre d'aide</div><div class="page-sub">Questions fréquentes & assistance</div></div></div>
      <div class="card card-pad">${faqs.map(([q, a]) => `<div class="faq-item"><div class="faq-q">❓ ${UI.esc(q)}</div><div class="faq-a">${UI.esc(a)}</div></div>`).join("")}</div>
      <div class="card card-pad mt-16">
        <strong>Besoin d'aide supplémentaire ?</strong>
        <p class="text-muted" style="margin:6px 0 12px;font-size:14px">Contactez directement la boutique concernée depuis sa vitrine ou une fiche article.</p>
        <a href="#/" class="btn btn-primary">Parcourir les boutiques</a>
      </div>`);
  }

  /* ============================================================
     VUE : Annuaire des boutiques (réputation, tri)
     ============================================================ */
  function viewStores(params) {
    const q = params.query || {};
    const sort = q.sort || "note";
    const commune = q.commune || "";
    let stores = Store.all().filter((s) => !s.suspended);
    if (commune) stores = stores.filter((s) => s.commune === commune);
    const meta = stores.map((s) => {
      const rt = Store.rating(s.id);
      const rel = sellerReliability(s.id);
      const nbProducts = Products.byStore(s.id).length;
      return { s, rt, rel, nbProducts };
    });
    meta.sort((a, b) => {
      if (sort === "note") return (b.rt.avg - a.rt.avg) || (b.rt.count - a.rt.count);
      if (sort === "articles") return b.nbProducts - a.nbProducts;
      if (sort === "commandes") return b.rel.orders - a.rel.orders;
      return a.s.name.localeCompare(b.s.name);
    });
    const communes = Array.from(new Set(Store.all().map((s) => s.commune))).sort();
    const sortOpts = [["note", "Mieux notées"], ["articles", "Plus d'articles"], ["commandes", "Plus de ventes"], ["nom", "Nom (A-Z)"]];
    const cards = meta.map(({ s, rt, rel, nbProducts }) => `
      <a href="#/store/${s.id}" class="store-card">
        <div class="store-card-banner" style="${s.banner ? `background-image:url('${UI.esc(s.banner)}')` : (s.themeColor ? `background:${UI.esc(s.themeColor)}` : "")}"></div>
        <div class="store-card-body">
          <img class="store-card-logo" src="${UI.safeImg(s.logo, s.name)}" alt="" />
          <div class="store-card-main">
            <div class="store-card-name">${UI.esc(s.name)}${rel.delivRate >= 90 && rel.orders >= 5 ? ` <span class="verified-badge" title="Vendeur fiable">✔️</span>` : ""}</div>
            <div class="store-card-meta">📍 ${UI.esc(s.commune)}</div>
            <div class="store-card-meta">${rt.count ? UI.starsHTML(rt.avg) + ` <span class="text-muted">(${rt.count})</span>` : `<span class="text-muted">Nouvelle boutique</span>`}</div>
          </div>
        </div>
        <div class="store-card-stats">
          <span>📦 ${nbProducts} article(s)</span>
          <span>🚚 ${rel.orders} vente(s)</span>
          ${rel.orders ? `<span>✅ ${rel.delivRate}% livrées</span>` : ""}
        </div>
      </a>`).join("");
    layout(`
      <div class="page-head"><div><div class="page-title">🏪 Nos boutiques</div><div class="page-sub">${stores.length} boutique(s) — payez à la livraison</div></div></div>
      <div class="filter-bar">
        <label class="inline-field">Trier
          <select id="stSort">${sortOpts.map(([v, l]) => `<option value="${v}" ${sort === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </label>
        <label class="inline-field">Commune
          <select id="stCommune"><option value="">Toutes</option>${communes.map((c) => `<option value="${UI.esc(c)}" ${commune === c ? "selected" : ""}>${UI.esc(c)}</option>`).join("")}</select>
        </label>
      </div>
      ${stores.length ? `<div class="stores-grid">${cards}</div>` : emptyState("🏪", "Aucune boutique", "Aucune boutique ne correspond à ce filtre.")}`);
    const rebuild = () => {
      const s = document.getElementById("stSort").value;
      const c = document.getElementById("stCommune").value;
      Router.go(`#/stores?sort=${encodeURIComponent(s)}${c ? "&commune=" + encodeURIComponent(c) : ""}`);
    };
    document.getElementById("stSort").addEventListener("change", rebuild);
    document.getElementById("stCommune").addEventListener("change", rebuild);
  }

  /* ============================================================
     VUE : Mon activité (vus, recherches, alertes, comparaison)
     ============================================================ */
  function viewActivity() {
    if (!requireAuth()) return;
    const user = Auth.current();
    const recent = Recent.list();
    const hist = SearchHist.list();
    const priceAlerts = Alerts.forUser(user.id);
    const saved = SavedSearches.forUser(user.id);
    const cmp = Compare.list().map((id) => Products.get(id)).filter((p) => p);

    const histHTML = hist.length
      ? `<div class="chips-row">${hist.map((t) => `<a href="#/search?q=${encodeURIComponent(t)}" class="chip">🔎 ${UI.esc(t)}</a>`).join("")} <button class="btn btn-ghost btn-sm" id="clrHist">Effacer</button></div>`
      : `<p class="text-muted">Aucune recherche récente.</p>`;

    const alertsHTML = priceAlerts.length
      ? priceAlerts.map((a) => { const p = Products.get(a.productId); if (!p) return ""; return `<div class="activity-row"><a href="#/product/${p.id}">${UI.esc(p.title)}</a><span class="text-muted">${a.type === "price" ? "Prix ≤ " + UI.fcfa(a.targetPrice) : "Retour en stock"}</span><button class="btn btn-ghost btn-sm" data-delalert="${a.id}">✕</button></div>`; }).join("")
      : `<p class="text-muted">Aucune alerte active. Créez-en depuis une fiche article.</p>`;

    const savedHTML = saved.length
      ? saved.map((s) => `<div class="activity-row"><a href="#/search?${savedSearchToQuery(s.filters)}">🔔 ${UI.esc(s.label)}</a><button class="btn btn-ghost btn-sm" data-delsaved="${s.id}">✕</button></div>`).join("")
      : `<p class="text-muted">Aucune alerte de recherche enregistrée.</p>`;

    layout(`
      <div class="page-head"><div><div class="page-title">📊 Mon activité</div><div class="page-sub">Votre historique et vos alertes</div></div></div>
      ${recent.length ? `<div class="section-title">🕘 Vus récemment <button class="btn btn-ghost btn-sm" id="clrRecent" style="float:right">Effacer</button></div>${gridHTML(recent)}` : ""}
      <div class="section-title">🔎 Recherches récentes</div><div class="card card-pad">${histHTML}</div>
      <div class="section-title">🔔 Mes alertes prix / réassort</div><div class="card card-pad">${alertsHTML}</div>
      <div class="section-title">📌 Mes alertes de recherche</div><div class="card card-pad">${savedHTML}</div>
      ${cmp.length ? `<div class="section-title">⚖️ Comparateur (${cmp.length})</div>${gridHTML(cmp)}` : ""}`);

    const cr = document.getElementById("clrRecent");
    if (cr) cr.addEventListener("click", () => { Recent.clear(); Router.resolve(); });
    const ch = document.getElementById("clrHist");
    if (ch) ch.addEventListener("click", () => { SearchHist.clear(); Router.resolve(); });
    V().querySelectorAll("[data-delalert]").forEach((b) => b.addEventListener("click", () => { Alerts.remove(b.getAttribute("data-delalert")); UI.toast("Alerte supprimée.", "info"); Router.resolve(); }));
    V().querySelectorAll("[data-delsaved]").forEach((b) => b.addEventListener("click", () => { SavedSearches.remove(b.getAttribute("data-delsaved")); UI.toast("Alerte de recherche supprimée.", "info"); Router.resolve(); }));
  }

  /** Convertit des filtres de recherche enregistrés en query-string. */
  function savedSearchToQuery(f) {
    const parts = [];
    if (f.q) parts.push("q=" + encodeURIComponent(f.q));
    if (f.category) parts.push("cat=" + encodeURIComponent(f.category));
    if (f.maxPrice) parts.push("max=" + encodeURIComponent(f.maxPrice));
    return parts.join("&");
  }

  /** Rappel de panier abandonné : notifie l'utilisateur connecté si son panier n'est pas vide. */
  function abandonedCartReminder() {
    if (!Auth.isLogged()) return;
    if (Cart.count() <= 0) return;
    // Une seule fois par session.
    if (sessionStorage.getItem("cartReminded")) return;
    sessionStorage.setItem("cartReminded", "1");
    const u = Auth.current();
    Notifications.push(u.id, { type: "info", message: `🛒 Vous avez ${Cart.count()} article(s) dans votre panier. Finalisez votre commande — paiement à la livraison !`, link: "#/cart" });
    UI.refreshBadges();
  }

  /** Rappel de suivi : notifie pour les commandes expédiées dont la livraison est proche. */
  function orderTrackingReminder() {
    const orders = Orders.mine().filter((o) => o.status === "expediee");
    if (!orders.length) return;
    orders.forEach((o) => {
      const key = "track_" + o.id;
      if (sessionStorage.getItem(key)) return;
      const eta = Orders.estimatedDelivery(o);
      // Rappel seulement quand la fenêtre de livraison a commencé.
      if (Date.now() < eta.from - 86400000) return;
      sessionStorage.setItem(key, "1");
      const uid = Auth.isLogged() ? Auth.current().id : o.buyerId;
      Notifications.push(uid, { type: "order_status", message: `📦 Votre commande ${o.number} est en route — livraison attendue d'ici le ${UI.dateFR(eta.to)}.`, link: "#/orders" });
    });
    UI.refreshBadges();
  }

  /** Barre de comparaison flottante (visible dès qu'un article est ajouté). */
  function renderCompareBar() {
    const root = document.getElementById("compareBarRoot");
    if (!root) return;
    const ids = Compare.list();
    if (!ids.length || location.hash.indexOf("#/compare") === 0 || location.hash.indexOf("#/seller") === 0) { root.innerHTML = ""; return; }
    const items = ids.map((id) => Products.get(id)).filter((p) => p);
    if (!items.length) { root.innerHTML = ""; return; }
    root.innerHTML = `<div class="compare-bar">
      <div class="compare-thumbs">${items.map((p) => `<img src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/>`).join("")}</div>
      <a href="#/compare" class="btn btn-primary btn-sm">Comparer (${items.length})</a>
      <button class="icon-btn" id="cmpBarClear" title="Vider" style="width:34px;height:34px">✕</button>
    </div>`;
    const c = document.getElementById("cmpBarClear");
    if (c) c.addEventListener("click", () => { Compare.clear(); renderCompareBar(); });
  }

  /* ============================================================
     VUE : Fiche produit
     ============================================================ */
  function viewProduct(params) {
    const p = Products.get(params.id);
    if (!p) { layout(emptyState("😕", "Article introuvable", "Cet article n'existe plus.", `<a href="#/" class="btn btn-primary">Retour à l'accueil</a>`)); return; }
    Products.addView(p.id);
    Recent.add(p.id);
    const store = Store.get(p.storeId);
    const price = Products.effectivePrice(p);
    const hasPromo = Products.promoActive(p);
    const rt = Products.rating(p.id);
    const images = (p.images && p.images.length ? p.images : [UI.placeholder(p.title)]).map((s) => UI.safeImg(s, p.title));
    const closed = !!store.closed;
    const out = Products.effectiveStock(p) <= 0 || closed;
    const favActive = Fav.has(p.id) ? "active" : "";
    const isOwner = Auth.isLogged() && Auth.current().id === store.ownerId;
    // Vente flash : promo active se terminant dans moins de 3 jours.
    const isFlash = hasPromo && p.promoUntil && p.promoUntil - Date.now() < 3 * 86400000 && p.promoUntil > Date.now();

    const sizeSel = p.variants.sizes && p.variants.sizes.length
      ? `<div class="variant-row"><label>Taille</label><div class="variant-opts" id="sizeOpts">
          ${p.variants.sizes.map((s, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-size="${UI.esc(s)}">${UI.esc(s)}</button>`).join("")}
        </div></div>` : "";
    const colorSel = p.variants.colors && p.variants.colors.length
      ? `<div class="variant-row"><label>Couleur</label><div class="variant-opts" id="colorOpts">
          ${p.variants.colors.map((c, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-color="${UI.esc(c)}">${UI.esc(c)}</button>`).join("")}
        </div></div>` : "";

    layout(`
      <nav class="breadcrumb"><a href="#/">Accueil</a> › <a href="#/store/${store.id}">${UI.esc(store.name)}</a> › <span>${UI.esc(p.title)}</span></nav>
      <div class="pd-wrap">
        <div class="pd-gallery">
          <div class="pd-main"><img id="pdMain" src="${images[0]}" alt="${UI.esc(p.title)}" /></div>
          ${images.length > 1 ? `<div class="pd-thumbs">${images.map((im, i) => `<div class="pd-thumb ${i === 0 ? "active" : ""}" data-img="${i}"><img src="${im}" alt="" /></div>`).join("")}</div>` : ""}
        </div>
        <div class="pd-info">
          <div class="flex-between">
            <span class="tag ${p.condition === "occasion" ? "occasion" : ""}" style="position:static">${p.condition === "occasion" ? "Occasion" : "Neuf"}</span>
            ${rt.count ? UI.starsHTML(rt.avg) + `<span class="text-muted" style="font-size:13px">(${rt.count} avis)</span>` : `<span class="text-muted" style="font-size:13px">Aucun avis</span>`}
          </div>
          <h1>${UI.esc(p.title)}</h1>
          <div class="pd-price-row">
            <span class="pd-price">${UI.fcfa(price)}</span>
            ${hasPromo ? `<span class="pd-price-old">${UI.fcfa(p.price)}</span>` : ""}
            ${hasPromo && p.promoUntil && !isFlash ? `<span class="tag promo" style="position:static">Jusqu'au ${UI.dateFR(p.promoUntil)}</span>` : ""}
          </div>
          ${isFlash ? `<div class="flash-banner">⚡ <strong>Vente flash</strong> — se termine dans <span id="flashCountdown">…</span></div>` : ""}
          <div class="text-muted" id="pdStockLine" style="font-size:14px">${closed ? "🔒 Boutique fermée — commandes suspendues" : (Products.effectiveStock(p) <= 0 ? "❌ Rupture de stock" + (p.restockDate && p.restockDate > Date.now() ? ` — réappro prévu le ${UI.dateFR(p.restockDate)}` : "") : "✅ En stock : " + Products.effectiveStock(p) + " disponible(s)" + (p.trackVariantStock ? " (choisissez une variante)" : ""))}</div>
          <p class="pd-desc">${UI.esc(p.description)}</p>
          ${(p.tags && p.tags.length) ? `<div class="pd-tags">${p.tags.map((t) => `<a href="#/search?q=${encodeURIComponent(t)}" class="tag-chip">#${UI.esc(t)}</a>`).join("")}</div>` : ""}
          ${sizeSel}${colorSel}
          <div class="variant-row"><label>Quantité</label>
            <div class="qty-box"><button id="qtyMinus">−</button><span id="qtyVal">1</span><button id="qtyPlus">+</button></div>
          </div>
          <div class="flex gap-12 wrap mt-16">
            <button class="btn btn-primary btn-lg" id="addCart" ${out ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM7.16 14h9.45a2 2 0 0 0 1.9-1.37L21 6H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.44A2 2 0 0 0 8 18h12v-2H8z"/></svg>
              Ajouter au panier
            </button>
            <button class="btn btn-ghost btn-lg" id="pdFav"><span class="pc-fav ${favActive}" style="position:static;box-shadow:none;background:none;width:auto;height:auto"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 21s-6.7-4.35-9.33-8.36C.9 9.7 2.1 6 5.4 6a4.3 4.3 0 0 1 3.6 2 4.3 4.3 0 0 1 3.6-2c3.3 0 4.5 3.7 2.73 6.64C18.7 16.65 12 21 12 21z"/></svg></span>Favori</button>
          </div>
          <div class="text-muted" style="font-size:13px;margin-top:10px">🚚 Livraison : ${deliveryEstimateText(store)}</div>
          <a href="#/store/${store.id}" class="store-mini">
            <img src="${UI.safeImg(store.logo, store.name)}" alt="" />
            <div style="flex:1"><div class="sm-name">${UI.esc(store.name)}</div>
              <div class="sm-meta">📍 ${UI.esc(store.commune)} · Voir la boutique →</div></div>
          </a>
          ${(p.priceLog && p.priceLog.length) ? `<button class="btn-link-inline" id="priceHistBtn" style="margin-top:6px">📉 Voir l'historique de prix</button>` : ""}
          ${!isOwner ? `<div class="flex gap-8 wrap mt-8">
              <button class="btn btn-ghost btn-sm" id="cmpBtn">${Compare.has(p.id) ? "✓ Dans le comparateur" : "⚖️ Comparer"}</button>
              <button class="btn btn-ghost btn-sm" id="shareBtn">${SICON.wa} Partager</button>
              <button class="btn btn-ghost btn-sm" id="addToListBtn">📋 Ajouter à une liste</button>
              ${p.stock <= 0 ? `<button class="btn btn-ghost btn-sm" id="restockAlert">🔔 Alerte réassort</button>` : `<button class="btn btn-ghost btn-sm" id="priceAlert">🔔 Alerte prix</button>`}
              <button class="btn btn-ghost btn-sm" id="reportBtn">⚑ Signaler</button>
            </div>
            ${p.negotiable && !out ? `<button class="btn btn-outline btn-block mt-8" id="offerBtn">🤝 Faire une offre</button>` : ""}
            <button class="btn btn-ghost btn-block mt-8" id="askSeller">${SICON.chat} Poser une question au vendeur</button>`
            : `<button class="btn btn-ghost btn-block mt-8" id="posterBtn">🖼️ Générer une affiche promotionnelle</button>`}
        </div>
      </div>
      ${(() => { const bt = Products.boughtTogether(p.id, 4); return bt.length ? `<div class="section-title">🧩 Souvent achetés ensemble</div><div class="scroll-row">${bt.map(productCard).join("")}</div>` : ""; })()}
      <div class="section-title">💬 Questions & réponses</div>
      <div class="card card-pad" id="qnaBox">${qnaHTML(p, isOwner)}</div>
      <div class="section-title">Avis & notes</div>
      <div class="card card-pad" id="reviewsBox">${reviewsHTML(p.id, "product")}</div>
      ${(() => { const sim = similarProducts(p, 6); return sim.length ? `<div class="section-title">Vous aimerez aussi</div>${gridHTML(sim)}` : ""; })()}
    `);

    // --- Compte à rebours vente flash ---
    if (isFlash) {
      const el = () => document.getElementById("flashCountdown");
      const tick = () => {
        const node = el(); if (!node) return;
        let ms = p.promoUntil - Date.now();
        if (ms <= 0) { node.textContent = "terminée"; return; }
        const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
        node.textContent = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
      };
      tick(); addPageTimer(tick, 1000);
    }

    // --- Wiring galerie ---
    V().querySelectorAll(".pd-thumb").forEach((t) =>
      t.addEventListener("click", () => {
        V().querySelectorAll(".pd-thumb").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        document.getElementById("pdMain").src = images[Number(t.getAttribute("data-img"))];
      })
    );

    // --- Variantes ---
    function currentVariant() {
      const variant = {};
      const sz = V().querySelector("#sizeOpts .chip.active");
      const cl = V().querySelector("#colorOpts .chip.active");
      if (sz) variant.size = sz.getAttribute("data-size");
      if (cl) variant.color = cl.getAttribute("data-color");
      return variant;
    }
    // Met à jour la dispo affichée + le bouton selon la variante choisie (stock par variante).
    function updateAvailability() {
      if (closed) return;
      const avail = Products.stockFor(p, currentVariant());
      const line = document.getElementById("pdStockLine");
      const btn = document.getElementById("addCart");
      if (p.trackVariantStock) {
        line.textContent = avail > 0 ? "✅ En stock : " + avail + " disponible(s) pour cette variante" : "❌ Variante en rupture";
      }
      if (btn) btn.disabled = avail <= 0;
      qty = Math.min(qty, Math.max(1, avail));
      if (qtyVal) qtyVal.textContent = qty;
    }
    function wireVariant(containerId) {
      const c = document.getElementById(containerId);
      if (!c) return;
      c.querySelectorAll(".chip").forEach((b) =>
        b.addEventListener("click", () => {
          c.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          updateAvailability();
        })
      );
    }

    // --- Quantité ---
    let qty = 1;
    const qtyVal = document.getElementById("qtyVal");
    document.getElementById("qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
    document.getElementById("qtyPlus").addEventListener("click", () => { qty = Math.min(Products.stockFor(p, currentVariant()) || 1, qty + 1); qtyVal.textContent = qty; });

    wireVariant("sizeOpts");
    wireVariant("colorOpts");
    updateAvailability();

    // --- Ajout panier ---
    document.getElementById("addCart").addEventListener("click", () => {
      const res = Cart.add(p.id, qty, currentVariant());
      if (res.ok) { UI.toast("Ajouté au panier ✓", "success"); updateAvailability(); }
      else UI.toast(res.error, "error");
    });

    // --- Favori ---
    document.getElementById("pdFav").addEventListener("click", () => {
      const added = Fav.toggle(p.id);
      if (added === null) return;
      const star = document.querySelector("#pdFav .pc-fav");
      star.classList.toggle("active", added);
      UI.toast(added ? "Ajouté aux favoris ❤️" : "Retiré des favoris", added ? "success" : "info");
    });

    // --- Affiche promotionnelle (vendeur propriétaire) ---
    const posterBtn = document.getElementById("posterBtn");
    if (posterBtn) posterBtn.addEventListener("click", () => generateProductPoster(p));

    // --- Comparateur ---
    const cmpBtn = document.getElementById("cmpBtn");
    if (cmpBtn) cmpBtn.addEventListener("click", () => {
      const r = Compare.toggle(p.id);
      if (!r.ok) { UI.toast(r.error, "error"); return; }
      cmpBtn.textContent = r.added ? "✓ Dans le comparateur" : "⚖️ Comparer";
      renderCompareBar();
      if (r.added) UI.toast("Ajouté au comparateur", "success");
    });

    // --- Partage acheteur (WhatsApp + affiche) ---
    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) shareBtn.addEventListener("click", () => {
      const price = Products.effectivePrice(p);
      const link = location.origin + location.pathname + "#/product/" + p.id;
      const txt = `🛍️ ${p.title}\n💰 ${UI.fcfa(price)}\n🏪 ${store.name} — 📍 ${store.commune}\n💵 Paiement à la livraison sur Marché CI.\n🔗 ${link}`;
      UI.modal({
        title: "Partager cet article",
        body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Faites découvrir cet article à vos proches.</p>
          <div class="flex gap-8 wrap">
            <button class="btn wa-btn" id="shWa">${SICON.wa} WhatsApp</button>
            <button class="btn btn-ghost" id="shCopy">🔗 Copier le lien</button>
            <button class="btn btn-ghost" id="shPoster">🖼️ Créer une affiche</button>
            ${navigator.share ? `<button class="btn btn-ghost" id="shNative">📤 Autre…</button>` : ""}
          </div>`,
        onMount(m, close) {
          m.querySelector("#shWa").addEventListener("click", () => { waShare(txt); close(); });
          m.querySelector("#shPoster").addEventListener("click", () => { close(); generateProductPoster(p); });
          m.querySelector("#shCopy").addEventListener("click", () => { copyToClipboard(link); UI.toast("Lien copié ✓", "success"); });
          const nat = m.querySelector("#shNative");
          if (nat) nat.addEventListener("click", () => { navigator.share({ title: p.title, text: txt, url: link }).catch(() => {}); close(); });
        },
      });
    });

    // --- Alertes prix / réassort ---
    const priceAlert = document.getElementById("priceAlert");
    if (priceAlert) priceAlert.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour créer une alerte.", "info"); Router.go("#/login"); return; }
      openPriceAlertModal(p);
    });
    const restockAlert = document.getElementById("restockAlert");
    if (restockAlert) restockAlert.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour créer une alerte.", "info"); Router.go("#/login"); return; }
      Alerts.add(p.id, "restock", 0);
      UI.toast("🔔 Vous serez prévenu dès le retour en stock.", "success");
    });
    const reportBtn = document.getElementById("reportBtn");
    if (reportBtn) reportBtn.addEventListener("click", () => openReportModal(p));
    const addToListBtn = document.getElementById("addToListBtn");
    if (addToListBtn) addToListBtn.addEventListener("click", () => openAddToListModal(p.id));

    // --- Poser une question au vendeur ---
    const ask = document.getElementById("askSeller");
    if (ask) ask.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour contacter le vendeur.", "info"); Router.go("#/login"); return; }
      const u = Auth.current();
      // Pré-remplit un premier message référant l'article s'il n'y a pas encore d'échange.
      if (!Messages.conversation(store.id, u.id).length) {
        Messages.send({ storeId: store.id, buyerId: u.id, buyerName: u.name, from: "buyer", text: `Bonjour, je suis intéressé(e) par « ${p.title} ».`, productId: p.id });
      }
      Router.go("#/messages?s=" + encodeURIComponent(store.id));
    });

    // --- Historique de prix ---
    const priceHistBtn = document.getElementById("priceHistBtn");
    if (priceHistBtn) priceHistBtn.addEventListener("click", () => openPriceHistory(p));

    // --- Faire une offre (négociation) ---
    const offerBtn = document.getElementById("offerBtn");
    if (offerBtn) offerBtn.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour faire une offre.", "info"); Router.go("#/login"); return; }
      openOfferModal(p, store);
    });

    // --- Q&A public : wiring ---
    wireQna(p, store, isOwner);

    wireReviews(p.id, "product", store.ownerId);
  }

  /* ============================================================
     Historique de prix (modale + mini-graphe SVG)
     ============================================================ */
  function openPriceHistory(p) {
    const hist = Products.priceHistory(p);
    const cur = Products.effectivePrice(p);
    const min = Math.min.apply(null, hist.map((h) => h.price));
    const max = Math.max.apply(null, hist.map((h) => h.price));
    UI.modal({
      title: "📉 Historique de prix",
      body: `<div class="price-hist">
          ${sparklineSVG(hist.map((h) => h.price))}
          <div class="price-hist-stats">
            <div><span class="text-muted">Prix actuel</span><strong style="color:var(--brand)">${UI.fcfa(cur)}</strong></div>
            <div><span class="text-muted">Le plus bas</span><strong>${UI.fcfa(min)}</strong></div>
            <div><span class="text-muted">Le plus haut</span><strong>${UI.fcfa(max)}</strong></div>
          </div>
          <div class="price-hist-rows">${hist.slice().reverse().map((h) => `<div class="activity-row"><span class="text-muted">${UI.dateFR(h.at)}</span><strong>${UI.fcfa(h.price)}</strong></div>`).join("")}</div>
          ${cur <= min ? `<div class="price-hist-note">✅ C'est actuellement le prix le plus bas observé !</div>` : ""}
        </div>`,
      footer: `<button class="btn btn-primary" data-close>Fermer</button>`,
    });
  }

  /** Génère un mini-graphe (sparkline) SVG à partir d'une série de prix. */
  function sparklineSVG(values) {
    if (values.length < 2) return `<div class="text-muted" style="text-align:center;padding:12px">Pas assez de données pour tracer une courbe.</div>`;
    const w = 300, h = 90, pad = 6;
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad);
      return [x, y];
    });
    const line = pts.map((pt) => pt.join(",")).join(" ");
    const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
    return `<svg viewBox="0 0 ${w} ${h}" class="sparkline" preserveAspectRatio="none" role="img" aria-label="Courbe de prix">
      <polygon points="${area}" fill="var(--brand)" opacity="0.12"></polygon>
      <polyline points="${line}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${pts.map((pt) => `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.5" fill="var(--brand)"></circle>`).join("")}
    </svg>`;
  }

  /* ============================================================
     Négociation : faire une offre au vendeur
     ============================================================ */
  function openOfferModal(p, store) {
    const cur = Products.effectivePrice(p);
    UI.modal({
      title: "🤝 Faire une offre",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Proposez votre prix pour « ${UI.esc(p.title)} ». Le vendeur reçoit votre offre et peut l'accepter via la messagerie. Prix affiché : <strong>${UI.fcfa(cur)}</strong>.</p>
        <div class="field"><label>Votre offre (FCFA)</label><input type="number" id="offPrice" min="1" value="${Math.round(cur * 0.9)}" /></div>
        <div class="field mt-8"><label>Quantité</label><input type="number" id="offQty" min="1" value="1" /></div>
        <div class="field mt-8"><label>Message (optionnel)</label><textarea id="offMsg" placeholder="Bonjour, seriez-vous d'accord pour ce prix ?"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="offGo">Envoyer l'offre</button>`,
      onMount(m, close) {
        m.querySelector("#offGo").addEventListener("click", () => {
          const price = Number(m.querySelector("#offPrice").value);
          const qty = Math.max(1, Number(m.querySelector("#offQty").value) || 1);
          if (!(price > 0)) { UI.toast("Montant invalide.", "error"); return; }
          const note = m.querySelector("#offMsg").value.trim();
          const u = Auth.current();
          const text = `🤝 Offre : ${UI.fcfa(price)} × ${qty} pour « ${p.title} » (au lieu de ${UI.fcfa(cur)}).${note ? "\n" + note : ""}`;
          Messages.send({ storeId: store.id, buyerId: u.id, buyerName: u.name, from: "buyer", text, productId: p.id });
          UI.toast("Offre envoyée au vendeur ✓", "success");
          close();
          Router.go("#/messages?s=" + encodeURIComponent(store.id));
        });
      },
    });
  }

  /* ============================================================
     Questions & réponses publiques (produit)
     ============================================================ */
  function qnaHTML(p, isOwner) {
    const list = Questions.forProduct(p.id);
    let head = "";
    if (!isOwner) {
      head = Auth.isLogged()
        ? `<div class="qna-ask"><textarea id="qnaText" placeholder="Posez une question publique sur cet article…" rows="2"></textarea><button class="btn btn-primary btn-sm" id="qnaSend">Publier ma question</button></div>`
        : `<a href="#/login" class="btn btn-ghost btn-sm">Connectez-vous pour poser une question</a>`;
    }
    const items = list.length
      ? list.map((q) => `<div class="qna-item">
          <div class="qna-q"><span class="qna-icon">Q</span><div><strong>${UI.esc(q.userName || "Client")}</strong> — ${UI.dateFR(q.createdAt)}<div>${UI.esc(q.question)}</div></div></div>
          ${q.answer ? `<div class="qna-a"><span class="qna-icon">R</span><div><strong>Réponse du vendeur</strong><div>${UI.esc(q.answer)}</div></div></div>`
            : (isOwner ? `<div class="qna-answer-form"><textarea data-ansfield="${q.id}" placeholder="Répondre publiquement…" rows="2"></textarea><button class="btn btn-primary btn-sm" data-ans="${q.id}">Répondre</button></div>`
              : `<div class="qna-pending text-muted">En attente de réponse du vendeur…</div>`)}
        </div>`).join("")
      : `<p class="text-muted" style="text-align:center;padding:14px 0">Aucune question pour le moment. ${isOwner ? "" : "Soyez le premier à en poser une !"}</p>`;
    return head + (list.length ? `<div class="divider"></div>` : "") + items;
  }

  function wireQna(p, store, isOwner) {
    const box = document.getElementById("qnaBox");
    if (!box) return;
    const refresh = () => { box.innerHTML = qnaHTML(p, isOwner); wireQna(p, store, isOwner); };
    const sendBtn = box.querySelector("#qnaSend");
    if (sendBtn) sendBtn.addEventListener("click", () => {
      const t = box.querySelector("#qnaText").value.trim();
      if (!t) { UI.toast("Écrivez votre question.", "info"); return; }
      const r = Questions.ask(p.id, store.id, t);
      if (!r.ok) { UI.toast(r.error, "error"); return; }
      UI.toast("Question publiée ✓", "success"); refresh();
    });
    box.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", () => {
      const id = b.getAttribute("data-ans");
      const field = box.querySelector(`[data-ansfield="${id}"]`);
      const t = field ? field.value.trim() : "";
      if (!t) { UI.toast("Écrivez une réponse.", "info"); return; }
      Questions.answer(id, t);
      UI.toast("Réponse publiée ✓", "success"); refresh();
    }));
  }

  /* ============================================================
     Avis (partagés produit / boutique)
     ============================================================ */
  function reviewsHTML(targetId, targetType) {
    const src = targetType === "store" ? Store : Products;
    const list = src.reviews(targetId);
    const rt = src.rating(targetId);
    const user = Auth.current();
    const alreadyReviewed = user && list.some((r) => r.userId === user.id);

    let head = `<div class="flex-between wrap" style="margin-bottom:14px">
      <div><span style="font-size:30px;font-weight:800">${rt.avg ? rt.avg.toFixed(1) : "—"}</span>
      <span class="text-muted"> / 5 · ${rt.count} avis</span><div>${UI.starsHTML(rt.avg)}</div></div>`;
    if (user && !alreadyReviewed) head += `<button class="btn btn-primary btn-sm" id="openReview">Laisser un avis</button>`;
    else if (!user) head += `<a href="#/login" class="btn btn-ghost btn-sm">Connectez-vous pour noter</a>`;
    head += `</div>`;

    // Tri : les plus utiles d'abord, puis les plus récents.
    const sorted = list.slice().sort((a, b) => ((b.helpfulBy || []).length - (a.helpfulBy || []).length) || b.createdAt - a.createdAt);
    const items = sorted.length
      ? sorted.map((r) => reviewItem(r)).join("")
      : `<p class="text-muted" style="text-align:center;padding:20px 0">Aucun avis pour le moment. Soyez le premier !</p>`;
    return head + `<div class="divider"></div>` + items;
  }

  function reviewItem(r) {
    const initials = (r.userName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const me = Auth.current();
    const helpful = (r.helpfulBy || []).length;
    const votedByMe = me && (r.helpfulBy || []).includes(me.id);
    const isAuthor = me && me.id === r.userId;
    return `<div class="review" data-review="${r.id}">
      <div class="review-head">
        <div class="review-avatar">${UI.esc(initials)}</div>
        <div><strong>${UI.esc(r.userName)}</strong> ${r.verified ? `<span class="verified-badge">✓ Achat vérifié</span>` : ""} ${UI.starsHTML(r.rating)}
          <div class="notif-time">${UI.timeAgo(r.createdAt)}${r.editedAt ? " · modifié" : ""}</div></div>
      </div>
      ${r.comment ? `<p style="margin:6px 0 0">${UI.esc(r.comment)}</p>` : ""}
      ${r.photo ? `<img class="review-photo" src="${UI.safeImg(r.photo, "avis")}" data-revphoto="${r.id}" alt="Photo de l'avis" />` : ""}
      <div class="flex gap-8 mt-8 wrap" style="align-items:center">
        <button class="btn btn-ghost btn-sm helpful-btn ${votedByMe ? "active" : ""}" data-helpful="${r.id}">👍 Utile${helpful ? ` (${helpful})` : ""}</button>
        ${!r.reply ? `<button class="btn btn-ghost btn-sm reply-btn" data-reply="${r.id}" hidden>Répondre</button>` : ""}
        ${isAuthor ? `<button class="btn btn-ghost btn-sm" data-editrev="${r.id}">✏️ Modifier</button>
          <button class="btn btn-ghost btn-sm" data-delrev="${r.id}">🗑️ Supprimer</button>`
          : (me ? `<button class="btn btn-ghost btn-sm" data-reportrev="${r.id}" title="Signaler cet avis">⚑</button>` : "")}
      </div>
      ${r.reply ? `<div class="review-reply"><strong>Réponse du vendeur :</strong> ${UI.esc(r.reply.text)}</div>` : ""}
    </div>`;
  }

  function wireReviews(targetId, targetType, ownerId) {
    const box = document.getElementById("reviewsBox");
    if (!box) return;
    const user = Auth.current();

    const openBtn = box.querySelector("#openReview");
    if (openBtn) openBtn.addEventListener("click", () => openReviewModal(targetId, targetType));

    // Le propriétaire de la boutique peut répondre.
    if (user && ownerId && user.id === ownerId) {
      box.querySelectorAll(".reply-btn").forEach((b) => {
        b.hidden = false;
        b.addEventListener("click", () => openReplyModal(b.getAttribute("data-reply"), targetId, targetType));
      });
    }
    // Vote « utile ».
    box.querySelectorAll("[data-helpful]").forEach((b) => b.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour voter.", "info"); return; }
      Products.voteHelpful(b.getAttribute("data-helpful"));
      Router.resolve();
    }));
    // Photo d'avis → visionneuse.
    box.querySelectorAll("[data-revphoto]").forEach((img) => img.addEventListener("click", () => openLightbox([img.getAttribute("src")], 0)));

    // Gestion de son propre avis : modifier / supprimer.
    box.querySelectorAll("[data-editrev]").forEach((b) => b.addEventListener("click", () => openEditReviewModal(b.getAttribute("data-editrev"), targetId, targetType)));
    box.querySelectorAll("[data-delrev]").forEach((b) => b.addEventListener("click", () => {
      UI.confirm("Supprimer votre avis ? Cette action est définitive.", { danger: true, confirmLabel: "Supprimer" }).then((ok) => {
        if (!ok) return;
        const r = Products.removeReview(b.getAttribute("data-delrev"));
        if (r.ok) { UI.toast("Avis supprimé.", "info"); Router.resolve(); }
        else UI.toast(r.error, "error");
      });
    }));
    // Signalement d'un avis (par un autre utilisateur).
    box.querySelectorAll("[data-reportrev]").forEach((b) => b.addEventListener("click", () => {
      const reason = prompt("Motif du signalement (optionnel) :", "");
      if (reason === null) return; // annulé
      const r = Products.reportReview(b.getAttribute("data-reportrev"), reason);
      UI.toast(r.ok ? "Merci, l'avis a été signalé à la modération." : r.error, r.ok ? "success" : "info");
    }));
  }

  /** Modale d'édition de son propre avis (pré-remplie). */
  function openEditReviewModal(reviewId, targetId, targetType) {
    const src = targetType === "store" ? Store : Products;
    const rev = src.reviews(targetId).find((x) => x.id === reviewId);
    if (!rev) { UI.toast("Avis introuvable.", "error"); return; }
    let rating = rev.rating, photo = rev.photo || "";
    UI.modal({
      title: "Modifier mon avis",
      body: `<div class="field"><label>Note</label>${starPicker("erStars")}</div>
        <div class="field mt-16"><label>Commentaire (optionnel)</label>
        <textarea id="erComment" placeholder="Partagez votre expérience…">${UI.esc(rev.comment || "")}</textarea></div>
        <div class="field mt-8"><label>Photo (optionnel)</label>
        <input type="file" id="erPhoto" accept="image/*" /><div class="upl-previews" id="erPhotoPrev">${photo ? `<div class="upl-thumb"><img src="${photo}" alt=""/></div>` : ""}</div></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="erSave">Enregistrer</button>`,
      onMount(m, close) {
        // Pré-sélectionne les étoiles existantes.
        const stars = m.querySelector("#erStars");
        stars.querySelectorAll("span").forEach((s) => s.classList.toggle("on", Number(s.getAttribute("data-v")) <= rating));
        wireStarPicker("erStars", (v) => (rating = v));
        m.querySelector("#erPhoto").addEventListener("change", async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { photo = await UI.fileToDataURL(f, { maxSize: 900, maxBytes: 90 * 1024 }); m.querySelector("#erPhotoPrev").innerHTML = `<div class="upl-thumb"><img src="${photo}" alt=""/></div>`; }
          catch (x) { UI.toast("Image invalide.", "error"); }
        });
        m.querySelector("#erSave").addEventListener("click", () => {
          if (!rating) { UI.toast("Sélectionnez une note.", "error"); return; }
          const res = Products.updateReview(reviewId, { rating, comment: m.querySelector("#erComment").value, photo });
          if (res.ok) { UI.toast("Avis mis à jour ✓", "success"); close(); Router.resolve(); }
          else UI.toast(res.error, "error");
        });
      },
    });
  }

  function starPicker(id) {
    return `<div class="star-input" id="${id}">${[1,2,3,4,5].map((i) => `<span data-v="${i}">★</span>`).join("")}</div>`;
  }
  function wireStarPicker(id, onPick) {
    const el = document.getElementById(id);
    let val = 0;
    el.querySelectorAll("span").forEach((s) =>
      s.addEventListener("click", () => {
        val = Number(s.getAttribute("data-v"));
        el.querySelectorAll("span").forEach((x) => x.classList.toggle("on", Number(x.getAttribute("data-v")) <= val));
        onPick(val);
      })
    );
  }

  function openReviewModal(targetId, targetType) {
    let rating = 0, photo = "";
    UI.modal({
      title: "Votre avis",
      body: `<div class="field"><label>Note</label>${starPicker("revStars")}</div>
        <div class="field mt-16"><label>Commentaire (optionnel)</label>
        <textarea id="revComment" placeholder="Partagez votre expérience…"></textarea></div>
        <div class="field mt-8"><label>Ajouter une photo (optionnel)</label>
        <input type="file" id="revPhoto" accept="image/*" /><div class="upl-previews" id="revPhotoPrev"></div></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="submitReview">Publier</button>`,
      onMount(m, close) {
        wireStarPicker("revStars", (v) => (rating = v));
        m.querySelector("#revPhoto").addEventListener("change", async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { photo = await UI.fileToDataURL(f, { maxSize: 900, maxBytes: 90 * 1024 }); m.querySelector("#revPhotoPrev").innerHTML = `<div class="upl-thumb"><img src="${photo}" alt=""/></div>`; }
          catch (x) { UI.toast("Image invalide.", "error"); }
        });
        m.querySelector("#submitReview").addEventListener("click", () => {
          if (!rating) { UI.toast("Sélectionnez une note.", "error"); return; }
          const res = Products.addReview({ targetType, targetId, rating, comment: m.querySelector("#revComment").value, photo });
          if (res.ok) { UI.toast("Merci pour votre avis !", "success"); close(); Router.resolve(); }
          else UI.toast(res.error, "error");
        });
      },
    });
  }

  function openReplyModal(reviewId, targetId, targetType, after) {
    UI.modal({
      title: "Répondre à l'avis",
      body: `<div class="field"><label>Votre réponse</label><textarea id="replyText" placeholder="Répondez au client…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="submitReply">Envoyer</button>`,
      onMount(m, close) {
        m.querySelector("#submitReply").addEventListener("click", () => {
          const txt = m.querySelector("#replyText").value.trim();
          if (!txt) { UI.toast("Réponse vide.", "error"); return; }
          Products.replyReview(reviewId, txt);
          UI.toast("Réponse envoyée.", "success");
          close(); if (after) after(); else Router.resolve();
        });
      },
    });
  }

  /* ============================================================
     VUE : Vitrine boutique
     ============================================================ */
  function viewStore(params) {
    const store = Store.get(params.id);
    if (!store) { layout(emptyState("🏪", "Boutique introuvable", "Cette boutique n'existe plus.")); return; }
    // Articles « à la une » d'abord, puis les plus récents.
    const products = Products.byStore(store.id).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.createdAt - a.createdAt);
    const subCount = Store.subscriberCount(store.id);
    const rt = Store.rating(store.id);
    const user = Auth.current();
    const subscribed = user && Store.isSubscribed(user.id, store.id);
    const isOwner = user && user.id === store.ownerId;

    const rel = sellerReliability(store.id);
    // Couleur d'accent personnalisée de la boutique (sécurisée : #hex uniquement).
    const accent = /^#[0-9a-fA-F]{3,8}$/.test(store.themeColor || "") ? store.themeColor : "";
    const accentStyle = accent ? ` style="--store-accent:${accent}"` : "";
    const gallery = (store.gallery || []).filter(Boolean);

    layout(`
      <div class="store-page"${accentStyle}>
      <div class="store-hero">
        <div class="store-banner"><img src="${UI.safeImg(store.banner, store.name)}" alt="" /></div>
        <div class="store-hero-body">
          <img class="store-logo" src="${UI.safeImg(store.logo, store.name)}" alt="${UI.esc(store.name)}" />
          <div class="store-hero-info">
            <h1>${UI.esc(store.name)}</h1>
            ${store.slogan ? `<div class="store-slogan">“${UI.esc(store.slogan)}”</div>` : ""}
            <div class="store-hero-meta">
              <span>📍 ${UI.esc(store.commune)}</span>
              <span>🏷️ ${UI.esc(UI.categoryLabel(store.category))}</span>
              <span>🕒 ${UI.esc(store.hours)}</span>
              ${store.schedule ? `<span class="open-badge ${Store.isOpenNow(store) ? "is-open" : "is-closed"}">${Store.isOpenNow(store) ? "🟢 Ouvert" : "🔴 Fermé"}</span>` : ""}
              <span>👥 ${subCount} abonné(s)</span>
              ${rt.count ? `<span>${UI.starsHTML(rt.avg)} (${rt.count})</span>` : ""}
              ${rel.orders >= 3 ? `<span title="Fiabilité">✅ ${rel.delivRate}% livrées${rel.avgHours ? ` · traitées en ~${rel.avgHours}h` : ""}</span>` : ""}
            </div>
          </div>
          <div class="flex gap-8 wrap">
            ${isOwner
              ? `<a href="#/seller/dashboard" class="btn btn-ghost">Gérer ma boutique</a>`
              : `<button class="btn ${subscribed ? "btn-ghost" : "store-accent-btn"}" id="subBtn">${subscribed ? "✓ Abonné" : "S'abonner"}</button>`}
            ${store.whatsapp ? `<a class="btn wa-btn" href="https://wa.me/225${UI.esc(store.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.9.9-2.7-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 6 8.9c0 1.8 1.3 3.5 1.5 3.7s2.6 4 6.3 5.4c2.2.8 2.6.6 3.1.6s1.4-.6 1.6-1.1.2-1 .1-1.1-.3-.2-.5-.3z"/></svg>WhatsApp</a>` : ""}
          </div>
        </div>
      </div>
      ${store.closed ? `<div class="store-ribbon closed">🔒 Boutique momentanément fermée${store.closedMsg ? " — " + UI.esc(store.closedMsg) : ""}. Les commandes sont suspendues.</div>` : ""}
      ${store.promoBanner ? `<div class="store-ribbon promo">📣 ${UI.esc(store.promoBanner)}</div>` : ""}
      <p class="text-muted" style="max-width:720px">${UI.esc(store.description)}</p>
      ${socialLinksHTML(store)}
      ${gallery.length ? (() => {
        const MAX = 6; // aperçu limité pour ne pas noyer les articles
        const preview = gallery.slice(0, MAX);
        const extra = gallery.length - MAX;
        return `<div class="section-title flex-between" style="align-items:center">
            <span>Galerie <span class="text-muted" style="font-weight:500;font-size:14px">(${gallery.length})</span></span>
            ${gallery.length > MAX ? `<button class="btn btn-ghost btn-sm" id="galSeeAll">🖼️ Voir toutes les photos</button>` : ""}
          </div>
          <div class="gallery-grid">${preview.map((img, i) => {
            const isLast = i === preview.length - 1 && extra > 0;
            return `<button class="gal-item ${isLast ? "gal-more" : ""}" data-gal="${i}"><img src="${UI.safeImg(img, store.name)}" alt="Photo ${i + 1} de ${UI.esc(store.name)}" loading="lazy" />${isLast ? `<span class="gal-more-overlay">+${extra}</span>` : ""}</button>`;
          }).join("")}</div>` ;
      })() : ""}
      <div class="section-title">Articles (${products.length})</div>
      ${gridHTML(products, "Cette boutique n'a pas encore publié d'article.")}
      ${store.faq ? `<div class="section-title">Questions fréquentes</div>
        <div class="card card-pad">${faqHTML(store.faq)}</div>` : ""}
      ${store.returnPolicy ? `<div class="card card-pad mt-16"><strong>↩︎ Politique de retour :</strong> ${UI.esc(store.returnPolicy)}</div>` : ""}
      <div class="section-title">Avis de la boutique</div>
      <div class="card card-pad" id="reviewsBox">${reviewsHTML(store.id, "store")}</div>
      </div>
    `);

    // Galerie -> visionneuse plein écran (ou grille complète pour la tuile « +N »).
    if (gallery.length) {
      const imgs = gallery.map((g) => UI.safeImg(g, store.name));
      V().querySelectorAll("[data-gal]").forEach((b) =>
        b.addEventListener("click", () => {
          if (b.classList.contains("gal-more")) openGalleryModal(imgs, store.name);
          else openLightbox(imgs, Number(b.getAttribute("data-gal")));
        })
      );
      const seeAll = document.getElementById("galSeeAll");
      if (seeAll) seeAll.addEventListener("click", () => openGalleryModal(imgs, store.name));
    }

    const subBtn = document.getElementById("subBtn");
    if (subBtn) subBtn.addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour vous abonner.", "info"); Router.go("#/login"); return; }
      const res = Store.toggleSubscribe(store.id);
      if (res.ok) { UI.toast(res.subscribed ? "Abonné ✓ Vous recevrez ses nouveautés." : "Désabonné.", res.subscribed ? "success" : "info"); Router.resolve(); }
    });
    wireReviews(store.id, "store", store.ownerId);
  }

  /* ============================================================
     VUE : Panier (multi-boutiques)
     ============================================================ */
  function viewCart() {
    const groups = Cart.grouped();
    const saved = Cart.savedList();
    const savedHTML = saved.length ? `
      <div class="section-title" style="margin-top:24px">🔖 Enregistré pour plus tard (${saved.length})</div>
      <div class="card" style="overflow:hidden">${saved.map(savedLineHTML).join("")}</div>` : "";
    if (!groups.length) {
      layout(`${emptyState("🛒", T("cart.empty"), T("cart.emptySub"), `<a href="#/" class="btn btn-primary">${T("cart.discover")}</a>`)}${savedHTML}`);
      wireSaved();
      return;
    }
    const total = Cart.total();
    const totalItems = Cart.count();

    const groupsHTML = groups.map((g) => `
      <div class="cart-store-group">
        <div class="cart-store-head">
          <img src="${UI.safeImg(g.store.logo, g.store.name)}" alt="" />
          <a href="#/store/${g.store.id}">${UI.esc(g.store.name)}</a>
          <span class="text-muted" style="margin-left:auto;font-weight:600;font-size:13px">${UI.fcfa(g.subtotal)}</span>
        </div>
        ${g.lines.map((l) => cartLineHTML(l)).join("")}
      </div>`).join("");

    layout(`
      <div class="page-head"><div><div class="page-title">${T("cart.title")}</div>
        <div class="page-sub">${totalItems} article(s) · ${groups.length} boutique(s)</div></div></div>
      <div class="cart-layout">
        <div>${groupsHTML}
          <div class="cod-note">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15-4-4 1.4-1.4L11 14.2l5.6-5.6L18 10z"/></svg>
            <span>Chaque boutique génère une commande distincte. <strong>Paiement en espèces à la livraison.</strong></span>
          </div>
        </div>
        <div class="summary">
          <div class="card card-pad">
            <h3 style="margin:0 0 12px">${T("cart.summary")}</h3>
            <div class="summary-row"><span>${T("cart.subtotal")}</span><span>${UI.fcfa(total)}</span></div>
            <div class="summary-row"><span>${T("cart.delivery")}</span><span class="text-muted">${T("cart.toAgree")}</span></div>
            <div class="summary-row total"><span>${T("cart.total")}</span><span>${UI.fcfa(total)}</span></div>
            <button class="btn btn-primary btn-block btn-lg mt-16" id="goCheckout">${T("cart.checkout")} (${groups.length})</button>
            <button class="btn btn-ghost btn-block mt-8" id="clearCart">${T("cart.clear")}</button>
          </div>
        </div>
      </div>
      ${savedHTML}`);

    // Wiring des lignes.
    V().querySelectorAll("[data-line]").forEach((row) => {
      const pid = row.getAttribute("data-pid");
      const variant = JSON.parse(row.getAttribute("data-variant") || "{}");
      row.querySelector(".ci-minus").addEventListener("click", () => { changeQty(pid, variant, -1); });
      row.querySelector(".ci-plus").addEventListener("click", () => { changeQty(pid, variant, 1); });
      row.querySelector(".ci-del").addEventListener("click", () => { Cart.removeLine(pid, variant); UI.toast("Article retiré.", "info"); viewCart(); });
      row.querySelector(".ci-savelater").addEventListener("click", () => { Cart.saveForLater(pid, variant); UI.toast("Gardé pour plus tard 🔖", "success"); viewCart(); });
    });
    wireSaved();
    document.getElementById("goCheckout").addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour commander.", "info"); Router.go("#/login"); return; }
      Router.go("#/checkout");
    });
    document.getElementById("clearCart").addEventListener("click", async () => {
      if (await UI.confirm("Vider entièrement votre panier ?", { danger: true, confirmLabel: "Vider" })) { Cart.clear(); viewCart(); }
    });
  }

  /** Wiring des lignes « gardées pour plus tard ». */
  function wireSaved() {
    V().querySelectorAll("[data-saved]").forEach((row) => {
      const pid = row.getAttribute("data-pid");
      const variant = JSON.parse(row.getAttribute("data-variant") || "{}");
      const toCart = row.querySelector(".ci-tocart");
      if (toCart) toCart.addEventListener("click", () => { const r = Cart.moveToCart(pid, variant); UI.toast(r.ok ? "Remis au panier ✓" : r.error, r.ok ? "success" : "error"); viewCart(); });
      row.querySelector(".ci-delsaved").addEventListener("click", () => { Cart.removeSaved(pid, variant); UI.toast("Retiré.", "info"); viewCart(); });
    });
  }

  function cartLineHTML(l) {
    const vparts = [];
    if (l.variant && l.variant.size) vparts.push("Taille : " + l.variant.size);
    if (l.variant && l.variant.color) vparts.push("Couleur : " + l.variant.color);
    // Alertes : rupture de stock, ou baisse de prix depuis l'ajout au panier.
    const out = l.product.stock <= 0;
    const dropped = l.addedPrice != null && l.unit < l.addedPrice;
    return `<div class="cart-item" data-line data-pid="${l.product.id}" data-variant='${UI.esc(JSON.stringify(l.variant || {}))}'>
      <img src="${UI.safeImg(l.product.images && l.product.images[0], l.product.title)}" alt="${UI.esc(l.product.title)}" />
      <div class="cart-item-info">
        <h4><a href="#/product/${l.product.id}">${UI.esc(l.product.title)}</a></h4>
        ${vparts.length ? `<div class="ci-variant">${UI.esc(vparts.join(" · "))}</div>` : ""}
        <div class="ci-price">${UI.fcfa(l.unit)}${dropped ? ` <span class="ci-oldprice">${UI.fcfa(l.addedPrice)}</span>` : ""}</div>
        ${out ? `<div class="ci-alert alert-out">⚠️ En rupture de stock</div>` : (dropped ? `<div class="ci-alert alert-drop">🔻 Le prix a baissé de ${UI.fcfa(l.addedPrice - l.unit)} !</div>` : "")}
        <button class="btn-link-inline ci-savelater" style="margin-top:4px">🔖 Garder pour plus tard</button>
      </div>
      <div class="qty-box"><button class="ci-minus" aria-label="Diminuer la quantité">−</button><span>${l.qty}</span><button class="ci-plus" aria-label="Augmenter la quantité">+</button></div>
      <button class="icon-btn ci-del" title="Retirer" aria-label="Retirer du panier" style="width:38px;height:38px">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12l-1 13H7zM9 4h6l1 2H8z"/></svg>
      </button>
    </div>`;
  }

  /** Ligne d'un article « gardé pour plus tard ». */
  function savedLineHTML(s) {
    const price = Products.effectivePrice(s.product);
    const out = s.product.stock <= 0;
    return `<div class="cart-item saved-item" data-saved data-pid="${s.product.id}" data-variant='${UI.esc(JSON.stringify(s.variant || {}))}'>
      <img src="${UI.safeImg(s.product.images && s.product.images[0], s.product.title)}" alt="${UI.esc(s.product.title)}" />
      <div class="cart-item-info">
        <h4><a href="#/product/${s.product.id}">${UI.esc(s.product.title)}</a></h4>
        <div class="ci-price">${UI.fcfa(price)}</div>
        ${out ? `<div class="ci-alert alert-out">⚠️ En rupture</div>` : ""}
      </div>
      <div class="flex gap-8">
        <button class="btn btn-ghost btn-sm ci-tocart" ${out ? "disabled" : ""}>↩︎ Au panier</button>
        <button class="icon-btn ci-delsaved" title="Retirer" aria-label="Retirer" style="width:38px;height:38px">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12l-1 13H7zM9 4h6l1 2H8z"/></svg></button>
      </div>
    </div>`;
  }

  function changeQty(pid, variant, delta) {
    const line = Cart.items().find((i) => i.productId === pid && JSON.stringify(i.variant || {}) === JSON.stringify(variant));
    if (!line) return;
    Cart.setQty(pid, variant, line.qty + delta);
    viewCart();
  }

  /* ============================================================
     VUE : Checkout (paiement à la livraison)
     ============================================================ */
  function viewCheckout() {
    const groups = Cart.grouped();
    if (!groups.length) { Router.go("#/cart"); return; }
    // Commande possible en tant qu'invité (sans compte).
    const user = Auth.current() || { name: "", phone: "", commune: "", address: "", addresses: [] };
    const isGuest = !Auth.isLogged();
    const itemsTotal = Cart.total();
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${user.commune === c ? "selected" : ""}>${c}</option>`).join("");

    layout(`
      <nav class="breadcrumb"><a href="#/cart">Panier</a> › <span>Commande</span></nav>
      ${isGuest ? `<div class="guest-banner">🛍️ Vous commandez <strong>en tant qu'invité</strong>. <a href="#/login">Connectez-vous</a> ou créez un compte pour retrouver et suivre vos commandes.</div>` : ""}
      <div class="cart-layout">
        <div>
          <div class="card card-pad">
            <h3 style="margin:0 0 4px">Coordonnées de livraison</h3>
            <p class="text-muted" style="margin:0 0 18px;font-size:13.5px">Le règlement s'effectue en espèces à la réception.</p>
            <form id="checkoutForm" class="form-grid">
              ${(user.addresses || []).length ? `<div class="field"><label>Adresse enregistrée</label>
                <select id="dSaved"><option value="">— Saisir manuellement —</option>${user.addresses.map((a) => `<option value="${a.id}">${UI.esc(a.label || a.name)} — ${UI.esc(a.commune)}</option>`).join("")}</select></div>` : ""}
              <div class="form-grid form-2col">
                <div class="field"><label>Nom du destinataire *</label><input id="dName" value="${UI.esc(user.name)}" required /><span class="err">Nom requis.</span></div>
                <div class="field"><label>Téléphone *</label><input id="dPhone" value="${UI.esc(user.phone)}" placeholder="07 00 00 00 00" required /><span class="err">Numéro invalide.</span></div>
              </div>
              <div class="field"><label>Commune *</label><select id="dCommune">${communeOpts}</select><span class="err">Commune requise.</span></div>
              <div class="field"><label>Adresse / point de repère *</label><textarea id="dAddress" placeholder="Ex : Riviera Palmeraie, près de la station…" required>${UI.esc(user.address)}</textarea><span class="err">Adresse requise.</span></div>
              <div class="field"><label>Créneau de livraison souhaité</label>
                <select id="dSlot">
                  <option value="Dès que possible">Dès que possible</option>
                  <option value="Aujourd'hui (matin)">Aujourd'hui — matin</option>
                  <option value="Aujourd'hui (après-midi)">Aujourd'hui — après-midi</option>
                  <option value="Aujourd'hui (soir)">Aujourd'hui — soir</option>
                  <option value="Demain">Demain</option>
                  <option value="Ce week-end">Ce week-end</option>
                </select></div>
              <div class="field"><label>Note pour le livreur (optionnel)</label><input id="dNote" placeholder="Ex : appeler avant d'arriver" /></div>
            </form>
          </div>
          ${groups.map((g) => `<div class="cart-store-group mt-16">
            <div class="cart-store-head"><img src="${UI.safeImg(g.store.logo, g.store.name)}" alt=""/> ${UI.esc(g.store.name)}
            <span class="text-muted" style="margin-left:auto;font-weight:600;font-size:13px">${UI.fcfa(g.subtotal)}</span></div>
            ${g.lines.map((l) => `<div class="cart-item"><img src="${UI.safeImg(l.product.images && l.product.images[0], l.product.title)}" alt=""/>
              <div class="cart-item-info"><h4>${UI.esc(l.product.title)}</h4><div class="ci-variant">Qté : ${l.qty}</div></div>
              <div class="ci-price" style="font-weight:700;color:var(--brand)">${UI.fcfa(l.subtotal)}</div></div>`).join("")}
          </div>`).join("")}
        </div>
        <div class="summary">
          <div class="card card-pad">
            <h3 style="margin:0 0 12px">Total à payer</h3>
            <div class="summary-row"><span>${Cart.count()} article(s)</span><span>${UI.fcfa(itemsTotal)}</span></div>
            <div id="feeRows"></div>
            <div class="text-muted" style="font-size:11.5px;margin:2px 0 4px">Frais de livraison fixés par le vendeur ; ils peuvent être ajustés selon votre zone.</div>
            <div class="divider" style="margin:10px 0"></div>
            <div class="field" style="gap:6px"><label style="font-size:13px">Code promo</label>
              <div class="flex gap-8"><input id="couponInput" placeholder="Ex : BIENVENUE10" style="flex:1;padding:9px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--surface-2);color:var(--text);text-transform:uppercase" />
              <button class="btn btn-ghost btn-sm" id="applyCoupon" type="button">Appliquer</button></div>
              <div id="couponMsg" style="font-size:12px"></div>
            </div>
            <div class="summary-row total"><span>À régler à la livraison</span><span id="grandTotal">${UI.fcfa(itemsTotal)}</span></div>
            <div class="cod-note"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z"/></svg>
              <span>Paiement <strong>en espèces</strong> uniquement, à la réception.</span></div>
            <button class="btn btn-primary btn-block btn-lg mt-16" id="placeOrder">Valider la commande</button>
          </div>
        </div>
      </div>`);

    let couponCode = "";

    // Recalcule frais de livraison + remises selon commune et code promo.
    function refreshSummary() {
      const commune = document.getElementById("dCommune").value;
      let fees = 0, discountTotal = 0, rows = "", blocked = null;
      groups.forEach((g) => {
        const st = Store.get(g.store.id);
        if (!Store.servesCommune(st, commune)) blocked = st.name;
        let fee = Store.deliveryFee(st, commune);
        let freeByThreshold = st.freeShipThreshold && g.subtotal >= st.freeShipThreshold;
        let discount = 0;
        if (couponCode) {
          const v = Coupons.validate(g.store.id, couponCode, g.subtotal);
          if (v.ok) { discount = v.discount || 0; if (v.freeShip) fee = 0; }
        }
        if (freeByThreshold) fee = 0;
        fees += fee; discountTotal += discount;
        rows += `<div class="summary-row"><span>Livraison ${UI.esc(g.store.name)}</span><span>${fee > 0 ? UI.fcfa(fee) : "Gratuite" + (freeByThreshold ? " 🎉" : "")}</span></div>`;
      });
      if (discountTotal > 0) rows += `<div class="summary-row" style="color:var(--accent);font-weight:700"><span>Remise (${UI.esc(couponCode)})</span><span>− ${UI.fcfa(discountTotal)}</span></div>`;
      document.getElementById("feeRows").innerHTML = rows;
      document.getElementById("grandTotal").textContent = UI.fcfa(Math.max(0, itemsTotal - discountTotal) + fees);
      const btn = document.getElementById("placeOrder");
      if (blocked) { btn.disabled = true; btn.textContent = `Non livré à ${commune}`; }
      else { btn.disabled = false; btn.textContent = "Valider la commande"; }
    }
    document.getElementById("dCommune").addEventListener("change", refreshSummary);

    // Sélection d'une adresse enregistrée (carnet d'adresses).
    const savedSel = document.getElementById("dSaved");
    if (savedSel) savedSel.addEventListener("change", () => {
      const a = (Auth.current().addresses || []).find((x) => x.id === savedSel.value);
      if (!a) return;
      document.getElementById("dName").value = a.name;
      document.getElementById("dPhone").value = a.phone;
      document.getElementById("dCommune").value = a.commune;
      document.getElementById("dAddress").value = a.address;
      refreshSummary();
    });

    // Application d'un code promo.
    document.getElementById("applyCoupon").addEventListener("click", () => {
      const code = document.getElementById("couponInput").value.trim().toUpperCase();
      const msg = document.getElementById("couponMsg");
      if (!code) { couponCode = ""; msg.textContent = ""; refreshSummary(); return; }
      // Valide contre au moins une boutique du panier.
      let okStore = null;
      for (const g of groups) { const v = Coupons.validate(g.store.id, code, g.subtotal); if (v.ok) { okStore = g.store; break; } }
      if (okStore) { couponCode = code; msg.style.color = "var(--accent)"; msg.textContent = `✓ Code appliqué pour ${okStore.name}.`; }
      else { couponCode = ""; msg.style.color = "var(--danger)"; msg.textContent = "Code invalide pour votre panier."; }
      refreshSummary();
    });
    refreshSummary();

    document.getElementById("placeOrder").addEventListener("click", () => {
      const delivery = {
        name: document.getElementById("dName").value,
        phone: document.getElementById("dPhone").value,
        commune: document.getElementById("dCommune").value,
        address: document.getElementById("dAddress").value,
        note: document.getElementById("dNote").value,
      };
      const err = Orders.validateDelivery(delivery);
      if (err) { UI.toast(err, "error"); return; }
      // Ne met à jour le profil que pour un utilisateur connecté (pas les invités).
      if (Auth.isLogged()) Auth.updateProfile({ phone: delivery.phone, commune: delivery.commune, address: delivery.address });
      const res = Orders.checkout(delivery, { code: couponCode, slot: document.getElementById("dSlot").value });
      if (res.ok) {
        Router.go("#/order/" + res.orders[0].id + "?multi=" + res.orders.length);
      } else UI.toast(res.error, "error");
    });
  }

  /* ============================================================
     VUE : Confirmation de commande
     ============================================================ */
  function viewOrderConfirm(params) {
    const order = Orders.get(params.id);
    if (!order) { layout(emptyState("📦", "Commande introuvable", "")); return; }
    const multi = params.query && Number(params.query.multi) > 1 ? Number(params.query.multi) : 0;

    layout(`
      <div style="max-width:640px;margin:20px auto">
        <div class="card card-pad" style="text-align:center">
          <div style="font-size:64px;line-height:1">🎉</div>
          <h1 style="margin:8px 0 4px">Commande confirmée !</h1>
          <p class="text-muted">Merci pour votre confiance. ${multi ? `<strong>${multi} commandes</strong> ont été créées (une par boutique).` : ""}</p>
          <div style="display:inline-block;background:var(--brand-soft);color:var(--brand-dark);font-weight:800;padding:10px 20px;border-radius:var(--r-full);margin:12px 0">N° ${UI.esc(order.number)}</div>
          <div class="divider"></div>
          <div style="text-align:left">
            <div class="summary-row"><span>Boutique</span><strong>${UI.esc(order.storeName)}</strong></div>
            <div class="summary-row"><span>Articles (${order.items.reduce((s, i) => s + i.qty, 0)})</span><span>${UI.fcfa(order.itemsTotal != null ? order.itemsTotal : order.total)}</span></div>
            ${order.discount ? `<div class="summary-row" style="color:var(--accent)"><span>Remise ${order.couponCode ? "(" + UI.esc(order.couponCode) + ")" : ""}</span><span>− ${UI.fcfa(order.discount)}</span></div>` : ""}
            <div class="summary-row"><span>Livraison — ${UI.esc(order.delivery.commune)}</span><span>${order.deliveryFee ? UI.fcfa(order.deliveryFee) : "Gratuite"}</span></div>
            ${order.slot ? `<div class="summary-row"><span>Créneau souhaité</span><span>${UI.esc(order.slot)}</span></div>` : ""}
            <div class="summary-row"><span>Mode de paiement</span><span>💵 Espèces à la livraison</span></div>
            <div class="summary-row total"><span>Montant à régler</span><span>${UI.fcfa(order.total)}</span></div>
          </div>
          <div class="cod-note" style="text-align:left"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15-4-4 1.4-1.4L11 14.2l5.6-5.6L18 10z"/></svg>
            <span>Le vendeur vous contactera au <strong>${UI.esc(order.delivery.phone)}</strong> pour organiser la livraison.</span></div>
          ${order.guest ? `<div class="guest-banner" style="margin-top:16px">💡 Créez un compte pour <strong>suivre cette commande</strong> et retrouver votre historique. <a href="#/login?adopt=1">Créer mon compte</a></div>` : ""}
          <div class="flex gap-12 wrap" style="justify-content:center;margin-top:16px">
            <a href="#/orders" class="btn btn-primary">Voir mes commandes</a>
            <a href="#/" class="btn btn-ghost">Continuer mes achats</a>
          </div>
        </div>
      </div>`);
  }

  /* ============================================================
     VUE : Historique des commandes (acheteur)
     ============================================================ */
  function viewOrders() {
    const orders = Orders.mine();
    const isGuest = !Auth.isLogged();
    if (!orders.length) {
      layout(emptyState("📦", T("orders.empty"), T("orders.emptySub"), `<a href="#/" class="btn btn-primary">${T("cart.discover")}</a>`));
      return;
    }
    layout(`
      <div class="page-head"><div><div class="page-title">${T("orders.title")}</div>
        <div class="page-sub">${orders.length} commande(s)</div></div></div>
      ${isGuest ? `<div class="guest-banner">💡 Ces commandes sont enregistrées sur cet appareil. <a href="#/login?adopt=1">Créez un compte</a> pour les retrouver partout.</div>` : ""}
      ${orders.map((o) => orderCardBuyer(o)).join("")}`);

    V().querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => openCancelModal(b.getAttribute("data-cancel"), "buyer", viewOrders)));
    V().querySelectorAll("[data-invoice]").forEach((b) => b.addEventListener("click", () => printInvoice(Orders.get(b.getAttribute("data-invoice")))));
    V().querySelectorAll("[data-reorder]").forEach((b) => b.addEventListener("click", () => {
      const o = Orders.get(b.getAttribute("data-reorder")); let n = 0;
      o.items.forEach((it) => { const r = Cart.add(it.productId, it.qty, it.variant); if (r.ok) n++; });
      if (n) { UI.toast(`${n} article(s) remis au panier ✓`, "success"); Router.go("#/cart"); }
      else UI.toast("Ces articles ne sont plus disponibles.", "error");
    }));
    V().querySelectorAll("[data-rate]").forEach((b) => b.addEventListener("click", () => openRateDeliveryModal(b.getAttribute("data-rate"))));
    V().querySelectorAll("[data-problem]").forEach((b) => b.addEventListener("click", () => openOrderProblemModal(b.getAttribute("data-problem"))));
    V().querySelectorAll("[data-return]").forEach((b) => b.addEventListener("click", () => openReturnModal(b.getAttribute("data-return"))));
  }

  /** Demande de retour / échange / remboursement (commande livrée). */
  function openReturnModal(orderId) {
    const o = Orders.get(orderId);
    if (!o) return;
    const reasons = ["Article défectueux", "Ne correspond pas à la description", "Mauvaise taille", "Article endommagé à la livraison", "Erreur d'article", "Autre"];
    UI.modal({
      title: "↩️ Retour / échange",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Commande N° ${UI.esc(o.number)} — ${UI.esc(o.storeName)}. Le vendeur examinera votre demande.</p>
        <div class="field"><label>Type de demande</label>
          <select id="rtType"><option value="retour">Retour (remboursement)</option><option value="echange">Échange</option><option value="remboursement">Remboursement partiel</option></select></div>
        <div class="field mt-8"><label>Motif</label><select id="rtReason">${reasons.map((r) => `<option>${r}</option>`).join("")}</select></div>
        <div class="field mt-8"><label>Description (optionnel)</label><textarea id="rtNote" placeholder="Précisez votre demande…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="rtGo">Envoyer la demande</button>`,
      onMount(m, close) {
        m.querySelector("#rtGo").addEventListener("click", () => {
          const r = Orders.requestReturn(orderId, {
            type: m.querySelector("#rtType").value,
            reason: m.querySelector("#rtReason").value,
            note: m.querySelector("#rtNote").value,
          });
          if (!r.ok) { UI.toast(r.error || "Demande impossible.", "error"); return; }
          UI.toast("Demande envoyée au vendeur ✓", "success"); close(); viewOrders();
        });
      },
    });
  }

  /** Signaler un problème sur une commande (au vendeur + admin). */
  function openOrderProblemModal(orderId) {
    const o = Orders.get(orderId);
    if (!o) return;
    const reasons = ["Colis non reçu", "Article endommagé", "Article non conforme", "Retard de livraison", "Erreur de montant", "Autre"];
    UI.modal({
      title: "⚠️ Signaler un problème",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Commande N° ${UI.esc(o.number)} — ${UI.esc(o.storeName)}. Le vendeur sera informé et vous recontactera.</p>
        <div class="field"><label>Type de problème</label><select id="opReason">${reasons.map((r) => `<option>${r}</option>`).join("")}</select></div>
        <div class="field mt-8"><label>Description</label><textarea id="opNote" placeholder="Décrivez le problème rencontré…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-danger" id="opGo">Envoyer le signalement</button>`,
      onMount(m, close) {
        m.querySelector("#opGo").addEventListener("click", () => {
          const reason = m.querySelector("#opReason").value + (m.querySelector("#opNote").value.trim() ? " — " + m.querySelector("#opNote").value.trim() : "");
          DB.update(DB.KEYS.orders, orderId, { problem: { reason, resolved: false, at: Date.now() } });
          const store = Store.get(o.storeId);
          if (store) Notifications.push(store.ownerId, { type: "order", message: `⚠️ Problème signalé sur la commande N° ${o.number} : ${reason}`, link: "#/seller/orders" });
          DB.all(DB.KEYS.users).filter((u) => u.role === "admin").forEach((a) => Notifications.push(a.id, { type: "info", message: `⚠️ Litige commande N° ${o.number} (${o.storeName}) : ${reason}`, link: "#/admin" }));
          UI.toast("Signalement envoyé. Le vendeur va vous recontacter.", "success"); close(); viewOrders();
        });
      },
    });
  }

  function openRateDeliveryModal(orderId) {
    let stars = 0;
    UI.modal({
      title: "Noter la livraison",
      body: `<div class="field"><label>Votre satisfaction</label>${starPicker("delStars")}</div>
        <div class="field mt-16"><label>Commentaire (optionnel)</label><textarea id="delComment" placeholder="Rapidité, état du colis, contact du livreur…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="delGo">Envoyer</button>`,
      onMount(m, close) {
        wireStarPicker("delStars", (v) => (stars = v));
        m.querySelector("#delGo").addEventListener("click", () => {
          if (!stars) { UI.toast("Sélectionnez une note.", "error"); return; }
          Orders.rateDelivery(orderId, stars, m.querySelector("#delComment").value);
          UI.toast("Merci pour votre retour !", "success"); close(); viewOrders();
        });
      },
    });
  }

  /** Modale d'annulation de commande avec motif. */
  function openCancelModal(orderId, by, after) {
    const reasons = by === "buyer"
      ? ["J'ai changé d'avis", "Délai trop long", "Erreur de commande", "Trouvé ailleurs", "Autre"]
      : ["Rupture de stock", "Client injoignable", "Hors zone de livraison", "Adresse incorrecte", "Autre"];
    UI.modal({
      title: "Annuler la commande",
      body: `<div class="field"><label>Motif de l'annulation</label>
        <select id="cxReason">${reasons.map((r) => `<option value="${UI.esc(r)}">${UI.esc(r)}</option>`).join("")}</select></div>
        <div class="field mt-8"><label>Précision (optionnel)</label><input id="cxNote" placeholder="Ajouter un détail…" /></div>`,
      footer: `<button class="btn btn-ghost" data-close>Retour</button><button class="btn btn-danger" id="cxGo">Confirmer l'annulation</button>`,
      onMount(m, close) {
        m.querySelector("#cxGo").addEventListener("click", () => {
          const reason = m.querySelector("#cxReason").value + (m.querySelector("#cxNote").value.trim() ? " — " + m.querySelector("#cxNote").value.trim() : "");
          const res = Orders.cancel(orderId, reason, by);
          if (res.ok) { UI.toast("Commande annulée.", "info"); close(); if (after) after(); }
          else UI.toast(res.error || "Annulation impossible.", "error");
        });
      },
    });
  }

  function orderCardBuyer(o) {
    return `<div class="card card-pad mt-16">
      <div class="flex-between wrap">
        <div><strong>N° ${UI.esc(o.number)}</strong><div class="text-muted" style="font-size:13px">${UI.dateFR(o.createdAt)} · ${UI.esc(o.storeName)}</div></div>
        <span class="status ${o.status}">${Orders.STATUS[o.status]}</span>
      </div>
      ${o.status !== "annulee" ? deliveryStepper(o.status) : ""}
      ${(o.status !== "annulee" && o.status !== "livree") ? (() => { const e = Orders.estimatedDelivery(o); return `<div class="order-eta">🚚 Livraison estimée : <strong>entre le ${UI.dateFR(e.from)} et le ${UI.dateFR(e.to)}</strong></div>`; })() : ""}
      <div class="divider" style="margin:14px 0"></div>
      ${o.items.map((it) => `<div class="cart-item" style="padding:8px 0;border:none">
        <img src="${UI.safeImg(it.image, it.title)}" alt="" style="width:54px;height:54px" />
        <div class="cart-item-info"><h4><a href="#/product/${it.productId}">${UI.esc(it.title)}</a></h4>
        <div class="ci-variant">Qté : ${it.qty} × ${UI.fcfa(it.unit)}</div></div></div>`).join("")}
      ${o.discount ? `<div class="flex-between mt-8" style="font-size:13px;color:var(--accent)"><span>Remise ${o.couponCode ? "(" + UI.esc(o.couponCode) + ")" : ""}</span><span>− ${UI.fcfa(o.discount)}</span></div>` : ""}
      ${o.deliveryFee ? `<div class="flex-between mt-8" style="font-size:13px"><span class="text-muted">Dont livraison</span><span>${UI.fcfa(o.deliveryFee)}</span></div>` : ""}
      ${o.slot ? `<div class="flex-between" style="font-size:13px"><span class="text-muted">Créneau souhaité</span><span>${UI.esc(o.slot)}</span></div>` : ""}
      ${o.cancelReason ? `<div class="text-muted" style="font-size:12.5px;margin-top:6px"><em>Annulée : ${UI.esc(o.cancelReason)}</em></div>` : ""}
      <div class="flex-between mt-8"><span class="text-muted">💵 À payer à la livraison (${UI.esc(o.delivery.commune)})</span><strong style="font-size:17px;color:var(--brand)">${UI.fcfa(o.total)}</strong></div>
      <div class="flex gap-8 wrap mt-8">
        <button class="btn btn-ghost btn-sm" data-invoice="${o.id}">🧾 Reçu / facture</button>
        <button class="btn btn-ghost btn-sm" data-reorder="${o.id}">🔁 Commander à nouveau</button>
        ${o.status === "livree" && !o.deliveryRating ? `<button class="btn btn-accent btn-sm" data-rate="${o.id}">⭐ Noter la livraison</button>` : ""}
        ${o.status === "livree" && (!o.return || o.return.status === "refused") ? `<button class="btn btn-ghost btn-sm" data-return="${o.id}">↩️ Retour / échange</button>` : ""}
        ${o.status !== "annulee" ? `<button class="btn btn-ghost btn-sm" data-problem="${o.id}">⚠️ Signaler un problème</button>` : ""}
        ${(o.status === "en_attente" || o.status === "confirmee") ? `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">Annuler la commande</button>` : ""}
      </div>
      ${o.return ? `<div class="order-return-note return-${o.return.status}">↩️ Demande de ${UI.esc(o.return.type)} — ${o.return.status === "requested" ? "en attente du vendeur" : o.return.status === "accepted" ? "acceptée ✅" : "refusée ❌"}${o.return.resolution ? " — " + UI.esc(o.return.resolution) : ""}</div>` : ""}
      ${o.problem ? `<div class="order-problem-note">⚠️ Problème signalé : ${UI.esc(o.problem.reason)}${o.problem.resolved ? " <span class=\"text-muted\">(traité)</span>" : " <span class=\"text-muted\">(en cours de traitement)</span>"}</div>` : ""}
      ${o.deliveryRating ? `<div class="text-muted" style="font-size:13px;margin-top:6px">Votre note de livraison : ${UI.starsHTML(o.deliveryRating.stars)}${o.deliveryRating.comment ? " — " + UI.esc(o.deliveryRating.comment) : ""}</div>` : ""}
    </div>`;
  }

  /** Suivi de livraison visuel (barre d'étapes). */
  function deliveryStepper(status) {
    const steps = [["en_attente", "Reçue"], ["confirmee", "Confirmée"], ["expediee", "Expédiée"], ["livree", "Livrée"]];
    const idx = steps.findIndex((s) => s[0] === status);
    return `<div class="stepper">${steps.map(([k, l], i) => `
      <div class="step ${i <= idx ? "done" : ""} ${i === idx ? "current" : ""}">
        <div class="step-dot">${i < idx ? "✓" : i + 1}</div><div class="step-lbl">${l}</div>
      </div>${i < steps.length - 1 ? `<div class="step-line ${i < idx ? "done" : ""}"></div>` : ""}`).join("")}</div>`;
  }

  /* ============================================================
     VUE : Favoris
     ============================================================ */
  function viewFavorites(params) {
    if (!requireAuth()) return;
    const q = (params && params.query) || {};
    const wl = Wishlists.lists();
    const activeId = q.list || "default"; // "default" = ❤️ Mes favoris
    const active = activeId === "default" ? null : Wishlists.get(activeId);
    if (activeId !== "default" && !active) { Router.go("#/favorites"); return; }

    const list = activeId === "default"
      ? Fav.list().map((id) => Products.get(id)).filter((p) => p && p.status === "published")
      : Wishlists.items(activeId);

    // Onglets : favoris par défaut + listes personnalisées + « Nouvelle liste ».
    const tabs = `<div class="filter-bar" style="margin-bottom:14px">
      <a href="#/favorites" class="chip ${activeId === "default" ? "active" : ""}">❤️ Mes favoris (${Fav.list().length})</a>
      ${wl.map((l) => `<a href="#/favorites?list=${l.id}" class="chip ${activeId === l.id ? "active" : ""}">📋 ${UI.esc(l.name)} (${l.items.length})</a>`).join("")}
      <button class="chip" id="newListChip">➕ Nouvelle liste</button>
    </div>`;

    const title = active ? active.name : "Mes favoris";
    const listActions = active
      ? `<div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" id="shareList">${SICON.wa} Partager</button>
          <button class="btn btn-ghost btn-sm" id="renameList">✏️ Renommer</button>
          <button class="btn btn-ghost btn-sm" id="deleteList">🗑️ Supprimer</button>
        </div>` : "";

    layout(`
      <div class="page-head"><div><div class="page-title">${UI.esc(title)}</div>
        <div class="page-sub">${list.length} article(s)</div></div>${listActions}</div>
      ${tabs}
      ${list.length ? gridHTML(list) : emptyState("❤️", "Liste vide", active ? "Ajoutez des articles à cette liste depuis leur fiche (bouton « Ajouter à une liste »)." : "Ajoutez des articles à vos favoris pour les retrouver ici.", `<a href="#/" class="btn btn-primary">Explorer</a>`)}`);

    document.getElementById("newListChip").addEventListener("click", () => openCreateListModal());
    if (active) {
      document.getElementById("renameList").addEventListener("click", () => {
        UI.modal({
          title: "Renommer la liste",
          body: `<div class="field"><label>Nom de la liste</label><input type="text" id="wlName" value="${UI.esc(active.name)}" /></div>`,
          footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="wlGo">Renommer</button>`,
          onMount(m, close) { m.querySelector("#wlGo").addEventListener("click", () => { const r = Wishlists.rename(active.id, m.querySelector("#wlName").value); if (!r.ok) { UI.toast(r.error, "error"); return; } close(); Router.resolve(); }); },
        });
      });
      document.getElementById("deleteList").addEventListener("click", async () => {
        if (await UI.confirm(`Supprimer la liste « ${active.name} » ?`, { danger: true, confirmLabel: "Supprimer" })) { Wishlists.remove(active.id); UI.toast("Liste supprimée.", "info"); Router.go("#/favorites"); }
      });
      document.getElementById("shareList").addEventListener("click", () => {
        const items = Wishlists.items(active.id);
        if (!items.length) { UI.toast("Cette liste est vide.", "info"); return; }
        const lines = items.map((p) => `• ${p.title} — ${UI.fcfa(Products.effectivePrice(p))}`).join("\n");
        const txt = `🛍️ Ma liste « ${active.name} » sur Marché CI :\n${lines}\n\n💵 Paiement à la livraison.`;
        UI.modal({
          title: "Partager la liste",
          body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Partagez le contenu de votre liste « ${UI.esc(active.name)} ».</p>
            <div class="flex gap-8 wrap"><button class="btn wa-btn" id="slWa">${SICON.wa} WhatsApp</button><button class="btn btn-ghost" id="slCopy">🔗 Copier</button></div>`,
          onMount(m, close) {
            m.querySelector("#slWa").addEventListener("click", () => { waShare(txt); close(); });
            m.querySelector("#slCopy").addEventListener("click", () => { copyToClipboard(txt); UI.toast("Liste copiée ✓", "success"); });
          },
        });
      });
    }
  }

  /** Modale de création d'une nouvelle liste de souhaits. */
  function openCreateListModal(afterProductId) {
    UI.modal({
      title: "Nouvelle liste",
      body: `<div class="field"><label>Nom de la liste</label><input type="text" id="nlName" placeholder="Ex : Cadeaux, À acheter plus tard…" /></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="nlGo">Créer</button>`,
      onMount(m, close) {
        m.querySelector("#nlName").addEventListener("keydown", (e) => { if (e.key === "Enter") m.querySelector("#nlGo").click(); });
        m.querySelector("#nlGo").addEventListener("click", () => {
          const r = Wishlists.create(m.querySelector("#nlName").value);
          if (!r.ok) { UI.toast(r.error, "error"); return; }
          if (afterProductId) { Wishlists.toggle(r.list.id, afterProductId); UI.toast(`Ajouté à « ${r.list.name} » ✓`, "success"); close(); }
          else { close(); Router.go("#/favorites?list=" + r.list.id); }
        });
      },
    });
  }

  /** Modale « Ajouter à une liste » depuis une fiche produit. */
  function openAddToListModal(productId) {
    if (!Auth.isLogged()) { UI.toast("Connectez-vous pour créer des listes.", "info"); Router.go("#/login"); return; }
    const render = () => {
      const lists = Wishlists.lists();
      return lists.length
        ? lists.map((l) => `<label class="radio-item"><input type="checkbox" data-wl="${l.id}" ${Wishlists.has(l.id, productId) ? "checked" : ""}/> 📋 ${UI.esc(l.name)} <span class="text-muted">(${l.items.length})</span></label>`).join("")
        : `<p class="text-muted" style="margin:0">Vous n'avez pas encore de liste. Créez-en une !</p>`;
    };
    UI.modal({
      title: "Ajouter à une liste",
      body: `<div id="wlChoices">${render()}</div>
        <button class="btn btn-ghost btn-sm mt-8" id="wlNew">➕ Nouvelle liste</button>`,
      footer: `<button class="btn btn-primary btn-block" data-close>Terminé</button>`,
      onMount(m, close) {
        const wire = () => m.querySelectorAll("[data-wl]").forEach((c) => c.addEventListener("change", () => {
          const r = Wishlists.toggle(c.getAttribute("data-wl"), productId);
          UI.toast(r.added ? "Ajouté à la liste ✓" : "Retiré de la liste", r.added ? "success" : "info");
        }));
        wire();
        m.querySelector("#wlNew").addEventListener("click", () => {
          const name = prompt("Nom de la nouvelle liste :", "");
          if (!name) return;
          const r = Wishlists.create(name);
          if (!r.ok) { UI.toast(r.error, "error"); return; }
          Wishlists.toggle(r.list.id, productId);
          m.querySelector("#wlChoices").innerHTML = render();
          wire();
          UI.toast(`Ajouté à « ${r.list.name} » ✓`, "success");
        });
      },
    });
  }

  /* ============================================================
     VUE : Notifications
     ============================================================ */
  const NOTIF_ICON = {
    new_product: { bg: "ic-orange", svg: "<path fill='currentColor' d='M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z'/>" },
    new_order: { bg: "ic-green", svg: "<path fill='currentColor' d='M7 4V2h10v2h4v2h-2v14H5V6H3V4zM9 8v8h2V8zm4 0v8h2V8z'/>" },
    order_status: { bg: "ic-blue", svg: "<path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15-4-4 1.4-1.4L11 14.2l5.6-5.6L18 10z'/>" },
    review_reply: { bg: "ic-purple", svg: "<path fill='currentColor' d='M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z'/>" },
    info: { bg: "ic-blue", svg: "<path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z'/>" },
  };

  // Regroupe les types de notification en familles filtrables.
  const NOTIF_GROUP = { new_order: "orders", order_status: "orders", new_product: "news", review_reply: "news", message: "messages" };
  const NOTIF_FILTERS = [["all", "Tout"], ["orders", "Commandes"], ["news", "Nouveautés"], ["messages", "Messages"], ["info", "Autres"]];

  function notifFamily(type) { return NOTIF_GROUP[type] || "info"; }

  function viewNotifications(params) {
    if (!requireAuth()) return;
    const user = Auth.current();
    const q = params && params.query || {};
    const filter = q.f || "all";
    const all = Notifications.forUser(user.id);
    const list = filter === "all" ? all : all.filter((n) => notifFamily(n.type) === filter);

    // Regroupement temporel.
    const now = Date.now(), DAY = 86400000;
    const buckets = { "Aujourd'hui": [], "Cette semaine": [], "Plus ancien": [] };
    list.forEach((n) => {
      const age = now - n.createdAt;
      if (age < DAY) buckets["Aujourd'hui"].push(n);
      else if (age < 7 * DAY) buckets["Cette semaine"].push(n);
      else buckets["Plus ancien"].push(n);
    });

    const notifRow = (n) => {
      const ic = NOTIF_ICON[n.type] || NOTIF_ICON.info;
      return `<div class="notif-item ${n.read ? "" : "unread"}" data-notif="${n.id}" data-link="${UI.esc(n.link || "")}">
        <div class="notif-ico ${ic.bg}"><svg viewBox="0 0 24 24">${ic.svg}</svg></div>
        <div class="notif-body"><p>${UI.esc(n.message)}</p><div class="notif-time">${UI.timeAgo(n.createdAt)}</div></div>
        <button class="icon-btn notif-del" data-notifdel="${n.id}" title="Supprimer" aria-label="Supprimer" style="width:34px;height:34px">✕</button>
      </div>`;
    };

    const groupsHTML = Object.keys(buckets).filter((k) => buckets[k].length).map((k) =>
      `<div class="notif-group-label">${k}</div><div class="card" style="overflow:hidden;margin-bottom:12px">${buckets[k].map(notifRow).join("")}</div>`
    ).join("");

    layout(`
      <div class="page-head"><div><div class="page-title">Notifications</div>
        <div class="page-sub">${all.filter((n) => !n.read).length} non lue(s)</div></div>
        ${all.length ? `<div class="flex gap-8"><button class="btn btn-ghost btn-sm" id="markAll">Tout marquer lu</button><button class="btn btn-ghost btn-sm" id="clearAll">Effacer</button></div>` : ""}
      </div>
      <div class="filter-bar">${NOTIF_FILTERS.map(([v, l]) => { const cnt = v === "all" ? all.length : all.filter((n) => notifFamily(n.type) === v).length; return `<a href="#/notifications${v === "all" ? "" : "?f=" + v}" class="chip ${filter === v ? "active" : ""}">${l}${cnt ? ` (${cnt})` : ""}</a>`; }).join("")}</div>
      ${list.length ? groupsHTML : emptyState("🔔", "Aucune notification", filter === "all" ? "Abonnez-vous à des boutiques pour être alerté de leurs nouveautés." : "Aucune notification dans cette catégorie.")}`);

    V().querySelectorAll("[data-notif]").forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-notifdel]")) return;
        Notifications.markRead(el.getAttribute("data-notif"));
        const link = el.getAttribute("data-link");
        if (link) Router.go(link);
        else Router.resolve();
      })
    );
    V().querySelectorAll("[data-notifdel]").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); Notifications.remove(b.getAttribute("data-notifdel")); Router.resolve(); })
    );
    const markAll = document.getElementById("markAll");
    if (markAll) markAll.addEventListener("click", () => { Notifications.markAllRead(user.id); Router.resolve(); });
    const clearAll = document.getElementById("clearAll");
    if (clearAll) clearAll.addEventListener("click", async () => {
      if (await UI.confirm("Effacer toutes les notifications ?", { danger: true, confirmLabel: "Effacer" })) { Notifications.clearAll(user.id); Router.resolve(); }
    });
  }

  /* ============================================================
     VUE : Authentification (connexion / inscription)
     ============================================================ */
  function viewLogin(params) {
    if (Auth.isLogged()) { Router.go("#/profile"); return; }
    // ?mode=register ou ?adopt=1 (invité invité à créer un compte) ouvrent l'inscription.
    const q = params.query || {};
    const mode = (q.mode === "register" || q.adopt === "1") ? "register" : "login";
    SB().innerHTML = "";
    V().innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div style="text-align:center;margin-bottom:18px">
            <div style="font-size:40px">🛒</div>
            <h2 style="margin:6px 0 0">Bienvenue sur Marché CI</h2>
            <p class="text-muted" style="font-size:14px">Achetez et vendez près de chez vous.</p>
          </div>
          <div class="auth-tabs">
            <button class="auth-tab ${mode === "login" ? "active" : ""}" data-tab="login">Connexion</button>
            <button class="auth-tab ${mode === "register" ? "active" : ""}" data-tab="register">Inscription</button>
          </div>
          <div id="authForms"></div>
          <div class="divider"></div>
          <p class="text-muted" style="font-size:12.5px;text-align:center;margin:0">
            Comptes de test — Client : <strong>client@test.ci</strong> · Vendeur : <strong>elegance@test.ci</strong> · Admin : <strong>admin@test.ci</strong> (mot de passe : <strong>1234</strong>)
          </p>
        </div>
      </div>`;

    function renderForm(which) {
      const box = document.getElementById("authForms");
      if (which === "login") {
        box.innerHTML = `
          <form id="loginForm" class="form-grid">
            <div class="field"><label>E-mail</label><input type="email" id="lEmail" placeholder="vous@exemple.ci" required /></div>
            <div class="field"><label>Mot de passe</label><input type="password" id="lPass" placeholder="••••••" required /></div>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Se connecter</button>
          </form>`;
        document.getElementById("loginForm").addEventListener("submit", (e) => {
          e.preventDefault();
          const res = Auth.login(document.getElementById("lEmail").value, document.getElementById("lPass").value);
          if (res.ok) { Cart.mergeGuestInto(res.user.id); const adopted = Orders.adoptGuestOrders(res.user.id); UI.toast("Connecté ✓" + (adopted ? ` — ${adopted} commande(s) invité récupérée(s)` : ""), "success"); afterAuth(); }
          else UI.toast(res.error, "error");
        });
      } else {
        box.innerHTML = `
          <form id="regForm" class="form-grid">
            <div class="field"><label>Nom complet</label><input id="rName" placeholder="Votre nom" required /></div>
            <div class="field"><label>E-mail</label><input type="email" id="rEmail" placeholder="vous@exemple.ci" required /></div>
            <div class="field"><label>Téléphone</label><input id="rPhone" placeholder="07 00 00 00 00" /></div>
            <div class="field"><label>Mot de passe</label><input type="password" id="rPass" placeholder="Min. 4 caractères" required /></div>
            <label class="radio-item" style="border:1.5px solid var(--border);border-radius:var(--r-sm)">
              <input type="checkbox" id="rVendor" /> <span>Je veux vendre (ouvrir une boutique)</span>
            </label>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Créer mon compte</button>
          </form>`;
        document.getElementById("regForm").addEventListener("submit", (e) => {
          e.preventDefault();
          const res = Auth.register({
            name: document.getElementById("rName").value,
            email: document.getElementById("rEmail").value,
            phone: document.getElementById("rPhone").value,
            password: document.getElementById("rPass").value,
            role: document.getElementById("rVendor").checked ? "vendor" : "client",
          });
          if (res.ok) {
            Cart.mergeGuestInto(res.user.id);
            const adopted = Orders.adoptGuestOrders(res.user.id);
            UI.toast("Compte créé ✓" + (adopted ? ` — ${adopted} commande(s) récupérée(s)` : ""), "success");
            if (res.user.role === "vendor") { renderHeaderUser(); Router.go("#/seller/store"); }
            else afterAuth();
          } else UI.toast(res.error, "error");
        });
      }
    }
    function afterAuth() { renderHeaderUser(); UI.refreshBadges(); Router.go("#/"); }

    document.querySelectorAll(".auth-tab").forEach((t) =>
      t.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        renderForm(t.getAttribute("data-tab"));
      })
    );
    renderForm(mode);
  }

  /* ============================================================
     VUE : Profil
     ============================================================ */
  function viewProfile() {
    if (!requireAuth()) return;
    const user = Auth.current();
    const store = Store.byOwner(user.id);
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${user.commune === c ? "selected" : ""}>${c}</option>`).join("");

    const pts = Loyalty.points(user.id);
    const tier = Loyalty.tier(pts);
    const progress = tier.next ? Math.min(100, Math.round(((pts - tier.min) / (tier.next - tier.min)) * 100)) : 100;
    const refCode = Loyalty.referralCode(user);
    const addresses = user.addresses || [];
    const prefs = user.notifPrefs || { newProduct: true, orderStatus: true, messages: true };
    const avatarSrc = user.avatar ? UI.safeImg(user.avatar, user.name) : "";

    layout(`
      <div class="page-head"><div style="display:flex;align-items:center;gap:14px">
        <div style="position:relative">
          <div class="avatar-lg" id="avatarPreview">${avatarSrc ? `<img src="${avatarSrc}" alt=""/>` : UI.esc((user.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
          <button class="avatar-edit" id="avatarEdit" title="Changer la photo">📷</button>
          <input type="file" id="avatarInput" accept="image/*" hidden />
        </div>
        <div><div class="page-title">${UI.esc(user.name)}</div><div class="page-sub">${UI.esc(user.email)}</div></div>
      </div></div>

      <div class="card card-pad" style="background:linear-gradient(120deg,var(--brand-dark),var(--brand));color:#fff">
        <div class="flex-between wrap">
          <div><div style="font-size:13px;opacity:.9">Fidélité Marché CI</div>
            <div style="font-size:22px;font-weight:800">${tier.icon} ${tier.name} · ${pts} pts</div></div>
          <div style="text-align:right;font-size:12.5px;opacity:.9">${tier.next ? `Plus que ${tier.next - pts} pts pour le niveau suivant` : "Niveau maximum atteint 🎉"}</div>
        </div>
        <div class="goal-bar" style="margin-top:12px;background:rgba(255,255,255,.25)"><div class="goal-fill" style="width:${progress}%;background:#fff;color:var(--brand-dark)">${progress >= 12 ? progress + "%" : ""}</div></div>
        <div class="flex-between wrap mt-16" style="gap:8px">
          <div style="font-size:13px">🎁 Parrainage — code : <strong style="letter-spacing:1px">${refCode}</strong></div>
          <button class="btn btn-sm" id="refShare" style="background:#fff;color:var(--brand-dark)">${SICON.wa} Inviter un ami</button>
        </div>
      </div>

      <div class="card card-pad mt-16">
        <form id="profForm" class="form-grid">
          <div class="form-grid form-2col">
            <div class="field"><label>Nom complet</label><input id="pName" value="${UI.esc(user.name)}" /></div>
            <div class="field"><label>Téléphone</label><input id="pPhone" value="${UI.esc(user.phone)}" placeholder="07 00 00 00 00" /></div>
          </div>
          <div class="field"><label>Commune</label><select id="pCommune"><option value="">—</option>${communeOpts}</select></div>
          <div class="field"><label>Adresse / point de repère</label><textarea id="pAddress">${UI.esc(user.address)}</textarea></div>
          <div><button class="btn btn-primary" type="submit">Enregistrer</button></div>
        </form>
      </div>

      <div class="section-title">Carnet d'adresses</div>
      <div class="card card-pad">
        <div id="addrList">${addresses.length ? addresses.map((a) => addressRow(a)).join("") : `<p class="text-muted" style="margin:0">Aucune adresse enregistrée. Ajoutez-en pour un paiement plus rapide.</p>`}</div>
        <button class="btn btn-ghost btn-sm mt-16" id="addAddr">+ Ajouter une adresse</button>
      </div>

      <div class="section-title">${T("profile.prefs")}</div>
      <div class="card card-pad form-grid">
        <div class="field"><label>Taille du texte</label>
          <select id="pFont">
            <option value="normal" ${(user.fontScale || "normal") === "normal" ? "selected" : ""}>Normale</option>
            <option value="large" ${user.fontScale === "large" ? "selected" : ""}>Grande</option>
            <option value="xlarge" ${user.fontScale === "xlarge" ? "selected" : ""}>Très grande</option>
          </select></div>
        <div class="field"><label>Langue / Language</label>
          <select id="pLang">${I18n.LANGS.map(([code, label]) => `<option value="${code}" ${I18n.get() === code ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field"><label>Contraste élevé</label>
          <label class="switch"><input type="checkbox" id="pContrast" ${user.highContrast ? "checked" : ""} /><span class="track"></span><span>Améliore la lisibilité (couleurs plus marquées)</span></label></div>
        <div class="field"><label>Notifications</label>
          <label class="radio-item"><input type="checkbox" id="prefNew" ${prefs.newProduct !== false ? "checked" : ""}/> Nouveautés & baisses de prix des boutiques suivies</label>
          <label class="radio-item"><input type="checkbox" id="prefOrd" ${prefs.orderStatus !== false ? "checked" : ""}/> Suivi de mes commandes</label>
          <label class="radio-item"><input type="checkbox" id="prefMsg" ${prefs.messages !== false ? "checked" : ""}/> Messages des vendeurs</label>
        </div>
        <div><button class="btn btn-primary btn-sm" id="savePrefs">Enregistrer les préférences</button></div>
        <a href="#/help" class="btn btn-ghost btn-sm" style="align-self:flex-start">❓ Centre d'aide</a>
      </div>

      <div class="section-title">${T("profile.sellerSpace")}</div>
      <div class="card card-pad">
        ${store
          ? `<div class="flex-between wrap"><div><strong>${UI.esc(store.name)}</strong><div class="text-muted" style="font-size:13px">${Products.byStore(store.id, true).length} article(s) · ${Store.subscriberCount(store.id)} abonné(s)</div></div>
             <a href="#/seller/dashboard" class="btn btn-primary">Tableau de bord</a></div>`
          : `<div class="flex-between wrap"><div><strong>Devenez vendeur</strong><div class="text-muted" style="font-size:13px">Ouvrez votre boutique et vendez en quelques minutes.</div></div>
             <a href="#/seller/store" class="btn btn-accent">Ouvrir ma boutique</a></div>`}
      </div>

      ${user.role === "admin" ? `<div class="section-title">Administration</div><div class="card card-pad"><a href="#/admin" class="btn btn-ghost">Console d'administration</a></div>` : ""}

      <div class="section-title">${T("profile.security")}</div>
      <div class="card card-pad form-grid">
        <div class="flex gap-8 wrap">
          <button class="btn btn-ghost btn-sm" id="changePwBtn">🔑 Changer mon mot de passe</button>
          <button class="btn btn-ghost btn-sm" id="exportDataBtn">⬇️ Exporter mes données</button>
        </div>
        <div class="account-danger">
          <div><strong>Supprimer mon compte</strong><div class="text-muted" style="font-size:13px">Action définitive : vos données personnelles seront effacées.</div></div>
          <button class="btn btn-danger btn-sm" id="deleteAccBtn">Supprimer</button>
        </div>
      </div>

      <div class="mt-24"><button class="btn btn-danger" id="logoutBtn">Se déconnecter</button></div>
    `);

    document.getElementById("profForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const res = Auth.updateProfile({
        name: document.getElementById("pName").value,
        phone: document.getElementById("pPhone").value,
        commune: document.getElementById("pCommune").value,
        address: document.getElementById("pAddress").value,
      });
      if (res.ok) { UI.toast("Profil mis à jour ✓", "success"); renderHeaderUser(); }
      else UI.toast(res.error, "error");
    });

    // Avatar.
    document.getElementById("avatarEdit").addEventListener("click", () => document.getElementById("avatarInput").click());
    document.getElementById("avatarInput").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const url = await UI.fileToDataURL(f, { maxSize: 300, maxBytes: 40 * 1024 }); Auth.updateProfile({ avatar: url }); UI.toast("Photo mise à jour ✓", "success"); renderHeaderUser(); viewProfile(); }
      catch (x) { UI.toast("Image invalide.", "error"); }
    });

    // Parrainage.
    document.getElementById("refShare").addEventListener("click", () => {
      waShare(`Rejoignez-moi sur Marché CI 🛒, la marketplace ivoirienne (paiement à la livraison) ! Utilisez mon code de parrainage : ${refCode}`);
    });

    // Carnet d'adresses.
    document.getElementById("addAddr").addEventListener("click", () => openAddressModal(null, viewProfile));
    V().querySelectorAll("[data-editaddr]").forEach((b) => b.addEventListener("click", () => openAddressModal(b.getAttribute("data-editaddr"), viewProfile)));
    V().querySelectorAll("[data-deladdr]").forEach((b) => b.addEventListener("click", () => {
      const list = (Auth.current().addresses || []).filter((a) => a.id !== b.getAttribute("data-deladdr"));
      Auth.updateProfile({ addresses: list }); viewProfile();
    }));

    // Préférences.
    document.getElementById("savePrefs").addEventListener("click", () => {
      Auth.updateProfile({ notifPrefs: { newProduct: document.getElementById("prefNew").checked, orderStatus: document.getElementById("prefOrd").checked, messages: document.getElementById("prefMsg").checked } });
      UI.toast("Préférences enregistrées ✓", "success");
    });
    document.getElementById("pFont").addEventListener("change", (e) => {
      Auth.updateProfile({ fontScale: e.target.value }); applyFontScale(e.target.value); UI.toast("Taille du texte mise à jour.", "success");
    });

    // Langue.
    document.getElementById("pLang").addEventListener("change", (e) => {
      I18n.set(e.target.value); Auth.updateProfile({ lang: e.target.value });
      renderHeaderUser(); // menu utilisateur traduit
      UI.toast(e.target.value === "en" ? "Language updated ✓" : "Langue mise à jour ✓", "success");
      viewProfile(); // re-rend la vue courante avec la nouvelle langue
    });

    // Contraste élevé.
    document.getElementById("pContrast").addEventListener("change", (e) => {
      Auth.updateProfile({ highContrast: e.target.checked });
      document.documentElement.setAttribute("data-contrast", e.target.checked ? "high" : "normal");
      UI.toast(e.target.checked ? "Contraste élevé activé." : "Contraste normal.", "success");
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
      Auth.logout(); renderHeaderUser(); UI.refreshBadges(); UI.toast("Déconnecté.", "info"); Router.go("#/");
    });

    // Sécurité : changer le mot de passe.
    document.getElementById("changePwBtn").addEventListener("click", () => {
      UI.modal({
        title: "🔑 Changer mon mot de passe",
        body: `<div class="field"><label>Mot de passe actuel</label><input type="password" id="cpCurrent" /></div>
          <div class="field mt-8"><label>Nouveau mot de passe</label><input type="password" id="cpNew" placeholder="Min. 4 caractères" /></div>
          <div class="field mt-8"><label>Confirmer le nouveau mot de passe</label><input type="password" id="cpConfirm" /></div>`,
        footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="cpGo">Mettre à jour</button>`,
        onMount(m, close) {
          m.querySelector("#cpGo").addEventListener("click", () => {
            const cur = m.querySelector("#cpCurrent").value;
            const nw = m.querySelector("#cpNew").value;
            const cf = m.querySelector("#cpConfirm").value;
            if (nw !== cf) { UI.toast("Les mots de passe ne correspondent pas.", "error"); return; }
            const r = Auth.changePassword(cur, nw);
            if (!r.ok) { UI.toast(r.error, "error"); return; }
            UI.toast("Mot de passe mis à jour ✓", "success"); close();
          });
        },
      });
    });

    // Sécurité : exporter mes données (téléchargement JSON).
    document.getElementById("exportDataBtn").addEventListener("click", () => {
      const data = Auth.exportData();
      if (!data) return;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mes-donnees-marcheci.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      UI.toast("Vos données ont été exportées ⬇️", "success");
    });

    // Sécurité : supprimer le compte (double confirmation).
    document.getElementById("deleteAccBtn").addEventListener("click", () => {
      UI.modal({
        title: "Supprimer mon compte ?",
        body: `<p style="margin:0 0 12px">Cette action est <strong>définitive</strong>. Vos favoris, avis, questions et alertes seront effacés. Vos commandes passées sont conservées de manière anonyme pour les vendeurs.</p>
          <div class="field"><label>Pour confirmer, tapez <strong>SUPPRIMER</strong></label><input type="text" id="delConfirm" placeholder="SUPPRIMER" /></div>`,
        footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-danger" id="delGo">Supprimer définitivement</button>`,
        onMount(m, close) {
          m.querySelector("#delGo").addEventListener("click", () => {
            if (m.querySelector("#delConfirm").value.trim().toUpperCase() !== "SUPPRIMER") { UI.toast("Veuillez taper SUPPRIMER pour confirmer.", "error"); return; }
            Auth.deleteAccount();
            close(); renderHeaderUser(); UI.refreshBadges();
            UI.toast("Votre compte a été supprimé.", "info"); Router.go("#/");
          });
        },
      });
    });
  }

  function addressRow(a) {
    return `<div class="flex-between wrap" style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div><strong>${UI.esc(a.label || a.name)}</strong><div class="text-muted" style="font-size:13px">${UI.esc(a.name)} · ${UI.esc(a.phone)} — ${UI.esc(a.commune)}, ${UI.esc(a.address)}</div></div>
      <div class="flex gap-8"><button class="btn btn-ghost btn-sm" data-editaddr="${a.id}">Modifier</button><button class="icon-action danger" data-deladdr="${a.id}" title="Supprimer">${SICON.trash}</button></div>
    </div>`;
  }

  function openAddressModal(addrId, after) {
    const user = Auth.current();
    const a = addrId ? (user.addresses || []).find((x) => x.id === addrId) : null;
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${a && a.commune === c ? "selected" : ""}>${c}</option>`).join("");
    UI.modal({
      title: addrId ? "Modifier l'adresse" : "Nouvelle adresse",
      body: `<div class="form-grid">
        <div class="field"><label>Libellé</label><input id="aLabel" value="${UI.esc(a ? a.label : "")}" placeholder="Ex : Maison, Bureau" /></div>
        <div class="form-grid form-2col">
          <div class="field"><label>Nom du destinataire</label><input id="aName" value="${UI.esc(a ? a.name : user.name)}" /></div>
          <div class="field"><label>Téléphone</label><input id="aPhone" value="${UI.esc(a ? a.phone : user.phone)}" /></div>
        </div>
        <div class="field"><label>Commune</label><select id="aCommune">${communeOpts}</select></div>
        <div class="field"><label>Adresse / point de repère</label><textarea id="aAddress">${UI.esc(a ? a.address : "")}</textarea></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="aGo">Enregistrer</button>`,
      onMount(m, close) {
        m.querySelector("#aGo").addEventListener("click", () => {
          const rec = { id: addrId || DB.uid("adr"), label: m.querySelector("#aLabel").value.trim(), name: m.querySelector("#aName").value.trim(), phone: m.querySelector("#aPhone").value.trim(), commune: m.querySelector("#aCommune").value, address: m.querySelector("#aAddress").value.trim() };
          if (!rec.name || !Auth.validPhone(rec.phone) || !rec.address) { UI.toast("Renseignez nom, téléphone et adresse valides.", "error"); return; }
          let list = (Auth.current().addresses || []).slice();
          const i = list.findIndex((x) => x.id === rec.id);
          if (i >= 0) list[i] = rec; else list.push(rec);
          Auth.updateProfile({ addresses: list });
          UI.toast("Adresse enregistrée ✓", "success"); close(); if (after) after();
        });
      },
    });
  }

  /** Applique la taille d'affichage choisie (accessibilité) via un zoom global. */
  function applyFontScale(scale) {
    const map = { normal: "100%", large: "112%", xlarge: "125%" };
    document.documentElement.style.zoom = map[scale] || "100%";
  }

  /* ============================================================
     VENDEUR : Création / édition de boutique
     ============================================================ */
  /** Liste des membres du staff d'une boutique (avec bouton retirer). */
  function staffListHTML(store) {
    const staff = (store && store.staff) || [];
    if (!staff.length) return `<p class="text-muted" style="font-size:13px;margin:8px 0">Aucun membre pour le moment.</p>`;
    const roleLabel = { gerant: "Gérant", preparateur: "Préparateur" };
    return `<div class="staff-list">${staff.map((m) => `<div class="staff-row">
      <div><strong>${UI.esc(m.name)}</strong> <span class="tag" style="position:static">${roleLabel[m.role] || m.role}</span><div class="text-muted" style="font-size:12px">${UI.esc(m.email)}</div></div>
      <button type="button" class="btn btn-ghost btn-sm" data-staff-remove="${m.userId}">Retirer</button>
    </div>`).join("")}</div>`;
  }

  function viewStoreForm() {
    if (!requireAuth()) return;
    const user = Auth.current();
    const store = Store.managedBy(user.id);
    const editing = !!store;
    const isOwner = editing && store.ownerId === user.id;
    const s = store || {};
    const catOpts = UI.CATEGORIES.map((c) => `<option value="${c.id}" ${s.category === c.id ? "selected" : ""}>${c.icon} ${c.label}</option>`).join("");
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${s.commune === c ? "selected" : ""}>${c}</option>`).join("");

    const formCard = `
      <div class="card card-pad" style="max-width:840px">
        <form id="storeForm" class="form-grid">
          <div class="form-grid form-2col">
            <div class="field"><label>Logo (photo de profil)</label>${uploaderHTML("logoUp", s.logo ? [s.logo] : [], false)}</div>
            <div class="field"><label>Bannière (photo de couverture)</label>${uploaderHTML("bannerUp", s.banner ? [s.banner] : [], false)}</div>
          </div>
          <div class="field"><label>Nom de la boutique *</label><input id="sName" value="${UI.esc(s.name || "")}" required /></div>
          <div class="form-grid form-2col">
            <div class="field"><label>Slogan / accroche <span class="hint">(affiché sous le nom)</span></label><input id="sSlogan" value="${UI.esc(s.slogan || "")}" placeholder="Ex : La mode africaine à petit prix" maxlength="80" /></div>
            <div class="field"><label>Couleur de la boutique</label>
              <div class="flex gap-8" style="align-items:center"><input type="color" id="sColor" value="${UI.esc(s.themeColor || "#f97316")}" style="width:52px;height:42px;padding:2px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2)" />
              <span class="hint">Personnalise la vitrine.</span></div></div>
          </div>
          <div class="field"><label>Description</label><textarea id="sDesc" placeholder="Présentez votre boutique…">${UI.esc(s.description || "")}</textarea></div>
          <div class="field"><label>Galerie photos <span class="hint">— ambiance, boutique, coulisses (plusieurs photos)</span></label>${uploaderHTML("galUp", s.gallery || [], true)}</div>
          <div class="form-grid form-2col">
            <div class="field"><label>Catégorie</label><select id="sCat">${catOpts}</select></div>
            <div class="field"><label>Commune</label><select id="sCommune">${communeOpts}</select></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Horaires</label><input id="sHours" value="${UI.esc(s.hours || "Lun–Sam : 09h–19h")}" /></div>
            <div class="field"><label>WhatsApp</label><input id="sWa" value="${UI.esc(s.whatsapp || "")}" placeholder="07 00 00 00 00" /></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Instagram</label><input id="sIg" value="${UI.esc((s.socials && s.socials.instagram) || "")}" placeholder="pseudo (sans @) ou lien" /></div>
            <div class="field"><label>Facebook</label><input id="sFb" value="${UI.esc((s.socials && s.socials.facebook) || "")}" placeholder="nom de page ou lien" /></div>
          </div>
          <div class="field"><label>TikTok</label><input id="sTt" value="${UI.esc((s.socials && s.socials.tiktok) || "")}" placeholder="pseudo (sans @) ou lien" /></div>
          <div class="field"><label>Objectif de vente mensuel (FCFA) <span class="hint">— suivi de progression sur votre tableau de bord</span></label>
            <input type="number" id="sGoal" min="0" value="${s.salesGoal || ""}" placeholder="Ex : 500000" /></div>

          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">Disponibilité & vitrine</h3>
          <label class="switch"><input type="checkbox" id="sClosed" ${s.closed ? "checked" : ""} /><span class="track"></span><span>Boutique fermée (mode vacances) — bloque les commandes</span></label>
          <div class="field"><label>Message d'indisponibilité</label><input id="sClosedMsg" value="${UI.esc(s.closedMsg || "")}" placeholder="Ex : De retour le 15 mars" /></div>
          <div class="field">
            <label class="switch"><input type="checkbox" id="sUseSchedule" ${s.schedule ? "checked" : ""} /><span class="track"></span><span>Définir des horaires d'ouverture (ouverture/fermeture automatique)</span></label>
            <div id="scheduleBox" class="schedule-box" ${s.schedule ? "" : "hidden"}>
              ${[["mon", "Lundi"], ["tue", "Mardi"], ["wed", "Mercredi"], ["thu", "Jeudi"], ["fri", "Vendredi"], ["sat", "Samedi"], ["sun", "Dimanche"]].map(([k, l]) => {
                const d = (s.schedule && s.schedule[k]) || { open: "09:00", close: "19:00", closed: k === "sun" };
                return `<div class="schedule-row" data-day="${k}">
                  <span class="schedule-day">${l}</span>
                  <label class="schedule-closed"><input type="checkbox" data-sch-closed ${d.closed ? "checked" : ""}/> Fermé</label>
                  <input type="time" data-sch-open value="${d.open || "09:00"}" ${d.closed ? "disabled" : ""} />
                  <span>→</span>
                  <input type="time" data-sch-close value="${d.close || "19:00"}" ${d.closed ? "disabled" : ""} />
                </div>`;
              }).join("")}
            </div>
          </div>
          <div class="field"><label>Bandeau promotionnel de la vitrine <span class="hint">(optionnel)</span></label><input id="sPromoBanner" value="${UI.esc(s.promoBanner || "")}" placeholder="Ex : -20% sur tout le pagne ce week-end !" /></div>
          <div class="field"><label>Questions fréquentes (FAQ) <span class="hint">— une question/réponse par ligne, affichée en vitrine</span></label>
            <textarea id="sFaq" placeholder="Livrez-vous à Bouaké ? Oui, sous 48h.&#10;Peut-on payer par Wave ? Non, paiement à la livraison uniquement.">${UI.esc(s.faq || "")}</textarea></div>
          <div class="field"><label>Politique de retour <span class="hint">(optionnel)</span></label><input id="sReturn" value="${UI.esc(s.returnPolicy || "")}" placeholder="Ex : Retour possible sous 3 jours si article défectueux." /></div>

          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">Livraison</h3>
          <div class="form-grid form-2col">
            <div class="field"><label>Frais de livraison (FCFA)</label>
              <input type="number" id="sDefaultFee" min="0" value="${s.defaultFee || ""}" placeholder="Ex : 1000 (0 = gratuite)" />
              <span class="hint">Ajustable commande par commande (selon la distance).</span></div>
            <div class="field"><label>Livraison offerte dès (FCFA)</label>
              <input type="number" id="sFreeShip" min="0" value="${s.freeShipThreshold || ""}" placeholder="Ex : 25000 (0 = désactivé)" />
              <span class="hint">Au-delà de ce montant d'achat, la livraison est gratuite.</span></div>
          </div>

          ${editing ? `
          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">🔔 Notifications vendeur</h3>
          <p class="text-muted" style="font-size:12.5px;margin:0">Choisissez les événements pour lesquels vous voulez être notifié.</p>
          <label class="radio-item"><input type="checkbox" id="snOrder" ${(s.notifPrefs || {}).newOrder !== false ? "checked" : ""}/> Nouvelles commandes</label>
          <label class="radio-item"><input type="checkbox" id="snMsg" ${(s.notifPrefs || {}).message !== false ? "checked" : ""}/> Messages des clients</label>
          <label class="radio-item"><input type="checkbox" id="snStock" ${(s.notifPrefs || {}).lowStock !== false ? "checked" : ""}/> Stock faible / ruptures</label>
          <label class="radio-item"><input type="checkbox" id="snReview" ${(s.notifPrefs || {}).review !== false ? "checked" : ""}/> Nouveaux avis & questions</label>

          ${isOwner ? `
          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">👥 Équipe (staff)</h3>
          <p class="text-muted" style="font-size:12.5px;margin:0">Donnez accès à votre back-office à d'autres comptes. <strong>Gérant</strong> : accès complet. <strong>Préparateur</strong> : commandes & stock uniquement.</p>
          <div id="staffList">${staffListHTML(s)}</div>
          <div class="flex gap-8 wrap" style="align-items:flex-end">
            <div class="field" style="flex:1;min-width:180px"><label>E-mail du membre (compte existant)</label><input type="email" id="staffEmail" placeholder="collegue@exemple.ci" /></div>
            <div class="field"><label>Rôle</label><select id="staffRole"><option value="gerant">Gérant</option><option value="preparateur">Préparateur</option></select></div>
            <button type="button" class="btn btn-ghost" id="staffAdd">+ Inviter</button>
          </div>` : ""}
          ` : ""}

          <div class="flex gap-12">
            <button class="btn btn-primary btn-lg" type="submit">${editing ? "Enregistrer les modifications" : "Créer ma boutique"}</button>
            ${editing ? `<a href="#/store/${s.id}" class="btn btn-ghost btn-lg">Voir la vitrine</a>` : ""}
          </div>
        </form>
      </div>`;

    if (editing) {
      sellerLayout({
        active: "store",
        title: "Ma boutique",
        subtitle: "Informations de votre vitrine publique.",
        actions: `<a href="#/store/${s.id}" class="btn btn-ghost">Voir ma vitrine</a>`,
        body: formCard,
      });
    } else {
      layout(`<div class="seller-onboard">
        <div class="onboard-hero">
          <div class="oh-ico">🏪</div>
          <h1 class="page-title" style="margin:0">Ouvrez votre boutique</h1>
          <p class="text-muted" style="max-width:460px;margin:8px auto 0">Vendez vos articles sur Marché CI en quelques minutes — c'est gratuit et sans commission.</p>
          <div class="onboard-steps"><span>1 · Créez votre boutique</span><span>2 · Publiez vos articles</span><span>3 · Recevez vos commandes</span></div>
        </div>
        ${formCard}
      </div>`);
    }

    const logoUp = wireUploader("logoUp", s.logo ? [s.logo] : [], false);
    const bannerUp = wireUploader("bannerUp", s.banner ? [s.banner] : [], false);
    const galUp = wireUploader("galUp", s.gallery || [], true);

    // Horaires : affichage conditionnel + activer/désactiver les champs par jour.
    const useSch = document.getElementById("sUseSchedule");
    if (useSch) {
      useSch.addEventListener("change", () => { document.getElementById("scheduleBox").hidden = !useSch.checked; });
      V().querySelectorAll(".schedule-row [data-sch-closed]").forEach((cb) => cb.addEventListener("change", () => {
        const row = cb.closest(".schedule-row");
        row.querySelector("[data-sch-open]").disabled = cb.checked;
        row.querySelector("[data-sch-close]").disabled = cb.checked;
      }));
    }

    // Gestion du staff (propriétaire).
    if (isOwner) {
      const refreshStaff = () => { document.getElementById("staffList").innerHTML = staffListHTML(Store.get(s.id)); wireStaffRemove(); };
      function wireStaffRemove() {
        V().querySelectorAll("[data-staff-remove]").forEach((b) => b.addEventListener("click", () => {
          const uid = b.getAttribute("data-staff-remove");
          const st = Store.get(s.id);
          Store.update(s.id, { staff: (st.staff || []).filter((x) => x.userId !== uid) });
          UI.toast("Membre retiré.", "info"); refreshStaff();
        }));
      }
      wireStaffRemove();
      document.getElementById("staffAdd").addEventListener("click", () => {
        const email = document.getElementById("staffEmail").value.trim();
        const role = document.getElementById("staffRole").value;
        if (!email) { UI.toast("Saisissez un e-mail.", "error"); return; }
        const target = Auth.findByEmail(email);
        if (!target) { UI.toast("Aucun compte avec cet e-mail. Le membre doit d'abord créer un compte.", "error"); return; }
        if (target.id === user.id) { UI.toast("Vous êtes déjà propriétaire.", "info"); return; }
        const st = Store.get(s.id);
        const staff = (st.staff || []).filter((x) => x.userId !== target.id);
        staff.push({ userId: target.id, name: target.name, email: target.email, role });
        Store.update(s.id, { staff });
        Notifications.push(target.id, { type: "info", message: `👥 Vous avez été ajouté à l'équipe de « ${st.name} » (${role}).`, link: "#/seller/dashboard" });
        document.getElementById("staffEmail").value = "";
        UI.toast("Membre ajouté ✓", "success"); refreshStaff();
      });
    }

    document.getElementById("storeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById("sName").value,
        slogan: document.getElementById("sSlogan").value.trim(),
        themeColor: document.getElementById("sColor").value,
        gallery: galUp.get(),
        description: document.getElementById("sDesc").value,
        category: document.getElementById("sCat").value,
        commune: document.getElementById("sCommune").value,
        hours: document.getElementById("sHours").value,
        whatsapp: document.getElementById("sWa").value,
        logo: logoUp.get()[0] || "",
        banner: bannerUp.get()[0] || "",
        salesGoal: Number(document.getElementById("sGoal").value) || 0,
        closed: document.getElementById("sClosed").checked,
        closedMsg: document.getElementById("sClosedMsg").value.trim(),
        promoBanner: document.getElementById("sPromoBanner").value.trim(),
        faq: document.getElementById("sFaq").value.trim(),
        returnPolicy: document.getElementById("sReturn").value.trim(),
        defaultFee: Number(document.getElementById("sDefaultFee").value) || 0,
        freeShipThreshold: Number(document.getElementById("sFreeShip").value) || 0,
        socials: {
          instagram: document.getElementById("sIg").value.trim(),
          facebook: document.getElementById("sFb").value.trim(),
          tiktok: document.getElementById("sTt").value.trim(),
        },
      };
      // Horaires structurés.
      if (document.getElementById("sUseSchedule").checked) {
        const sch = {};
        V().querySelectorAll(".schedule-row").forEach((row) => {
          sch[row.getAttribute("data-day")] = {
            closed: row.querySelector("[data-sch-closed]").checked,
            open: row.querySelector("[data-sch-open]").value || "09:00",
            close: row.querySelector("[data-sch-close]").value || "19:00",
          };
        });
        data.schedule = sch;
      } else {
        data.schedule = null;
      }
      // Préférences de notification vendeur.
      if (editing) {
        data.notifPrefs = {
          newOrder: document.getElementById("snOrder").checked,
          message: document.getElementById("snMsg").checked,
          lowStock: document.getElementById("snStock").checked,
          review: document.getElementById("snReview").checked,
        };
      }
      if (editing) {
        const res = Store.update(s.id, data);
        if (res.ok) { UI.toast("Boutique mise à jour ✓", "success"); renderHeaderUser(); Router.go("#/seller/dashboard"); }
        else UI.toast(res.error, "error");
      } else {
        const res = Store.create(data);
        if (res.ok) { UI.toast("Boutique créée ✓ Bienvenue parmi les vendeurs !", "success"); renderHeaderUser(); Router.go("#/seller/dashboard"); }
        else UI.toast(res.error, "error");
      }
    });
  }

  /* ============================================================
     VENDEUR : Tableau de bord
     ============================================================ */
  function viewSellerDashboard() {
    if (!requireVendor()) return;
    const store = sellerStore();
    const products = Products.byStore(store.id, true);
    const publishedCount = products.filter((p) => p.status === "published").length;
    const orders = Orders.byStore(store.id);
    const pending = orders.filter((o) => o.status === "en_attente").length;
    const topViewed = products.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    const recentOrders = orders.slice(0, 5);
    const firstName = UI.esc(Auth.current().name.split(" ")[0]);

    // --- Analytics ---
    const sales7 = last7DaysSales(orders);
    const goal = store.salesGoal || 0;
    const mSales = monthSales(orders);
    const goalPct = goal > 0 ? Math.min(100, Math.round((mSales / goal) * 100)) : 0;
    const statusColors = { en_attente: "#f59e0b", confirmee: "#2563eb", expediee: "#7c3aed", livree: "#0f9d58", annulee: "#e11d48" };
    const donutSegs = Object.keys(Orders.STATUS).map((k) => ({ label: Orders.STATUS[k], value: orders.filter((o) => o.status === k).length, color: statusColors[k] }));

    // --- Alertes de stock ---
    const outStock = products.filter((p) => p.stock <= 0);
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK);

    // --- Score de complétude + checklist d'onboarding ---
    const checklist = [
      ["Logo (photo de profil)", !!store.logo, "#/seller/store"],
      ["Bannière (couverture)", !!store.banner, "#/seller/store"],
      ["Slogan de la boutique", !!store.slogan, "#/seller/store"],
      ["Galerie photos", (store.gallery || []).length > 0, "#/seller/store"],
      ["Description", (store.description || "").length > 10, "#/seller/store"],
      ["Contact WhatsApp", !!store.whatsapp, "#/seller/store"],
      ["Au moins 1 article publié", publishedCount > 0, "#/seller/product/new"],
      ["Objectif de vente défini", (store.salesGoal || 0) > 0, "#/seller/store"],
    ];
    const doneCount = checklist.filter((c) => c[1]).length;
    const completeness = Math.round((doneCount / checklist.length) * 100);

    // --- Conseils vendeur (coaching contextuel) ---
    const tips = [];
    const stalePending = orders.filter((o) => o.status === "en_attente" && Date.now() - o.createdAt > 24 * 3600000).length;
    if (stalePending) tips.push(["⏰", `${stalePending} commande(s) en attente depuis plus de 24 h — traitez-les vite.`, "#/seller/orders?status=en_attente"]);
    if (Coupons.byStore(store.id).filter((c) => c.active).length === 0) tips.push(["🏷️", "Créez un code promo pour attirer de nouveaux clients.", "#/seller/promos"]);
    if (!store.freeShipThreshold) tips.push(["🚚", "Proposez la livraison offerte dès un montant pour augmenter le panier.", "#/seller/store"]);
    if ((store.gallery || []).length < 3) tips.push(["📸", "Ajoutez des photos de galerie pour une vitrine plus attractive.", "#/seller/store"]);
    if (!products.some((p) => Products.promoActive(p))) tips.push(["💸", "Mettez un article en promotion pour dynamiser vos ventes.", "#/seller/products"]);
    if (products.some((p) => (p.images || []).length < 2)) tips.push(["🖼️", "Certains articles n'ont qu'une photo — ajoutez-en pour rassurer l'acheteur.", "#/seller/products"]);

    // --- Avis à traiter (sans réponse) ---
    const storeReviews = Store.reviews(store.id);
    const productReviews = products.reduce((acc, p) => acc.concat(Products.reviews(p.id).map((r) => Object.assign({ _pid: p.id, _ptitle: p.title }, r))), []);
    const pendingReviews = storeReviews.filter((r) => !r.reply).map((r) => Object.assign({ _store: true }, r))
      .concat(productReviews.filter((r) => !r.reply))
      .sort((a, b) => b.createdAt - a.createdAt);

    sellerLayout({
      active: "dashboard",
      title: "Tableau de bord",
      subtitle: `Bonjour ${firstName} — voici l'activité de votre boutique.`,
      actions: `<button class="btn btn-ghost" id="announceBtn">📣 Annonce</button>
                <button class="btn btn-ghost" id="qrBtn">${SICON.store} QR code</button>
                <button class="btn wa-btn" id="shareStoreBtn"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.9.9-2.7-.2-.3A8 8 0 1 1 12 20z"/></svg>Partager</button>
                <a href="#/seller/product/new" class="btn btn-primary">+ Article</a>`,
      body: `
        <div class="stat-grid">
          ${statCard("ic-green", "💰", UI.fcfa(store.revenueSim || 0), "Chiffre d'affaires")}
          ${statCard("ic-orange", "📦", publishedCount + " / " + products.length, "Articles publiés")}
          ${statCard("ic-blue", "🧾", orders.length, "Commandes reçues")}
          ${statCard("ic-purple", "👥", Store.subscriberCount(store.id), "Abonnés")}
        </div>
        ${pending ? `<div class="cod-note mt-16"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>
          <span><strong>${pending} commande(s) en attente</strong> — <a href="#/seller/orders" style="color:var(--brand);font-weight:700">à traiter maintenant</a>.</span></div>` : ""}

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>Ventes des 7 derniers jours</h3><span class="text-muted" style="font-size:13px">${UI.fcfa(sales7.reduce((s, d) => s + d.value, 0))}</span></div>
            ${barChartHTML(sales7)}
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>Commandes par statut</h3></div>
            ${donutHTML(donutSegs, orders.length, "commandes")}
          </div>
        </div>

        <div class="card card-pad mt-16">
          <div class="panel-head"><h3>Objectif de vente du mois</h3>
            ${goal > 0 ? `<span class="text-muted" style="font-size:13px">${UI.fcfa(mSales)} / ${UI.fcfa(goal)}</span>` : `<a href="#/seller/store" style="font-size:13px;color:var(--brand);font-weight:700">Définir un objectif →</a>`}</div>
          ${goal > 0 ? `<div class="goal-bar"><div class="goal-fill" style="width:${goalPct}%">${goalPct >= 12 ? goalPct + "%" : ""}</div></div>
            <div class="text-muted" style="font-size:13px;margin-top:8px">${goalPct >= 100 ? "🎉 Objectif atteint, bravo !" : `Encore ${UI.fcfa(Math.max(0, goal - mSales))} pour atteindre votre objectif.`}</div>`
            : `<p class="text-muted" style="margin:0">Fixez un objectif mensuel pour suivre votre progression.</p>`}
        </div>

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>Complétude de la boutique</h3><strong style="color:${completeness >= 100 ? "var(--accent)" : "var(--brand)"}">${completeness}%</strong></div>
            <div class="goal-bar" style="margin-bottom:14px"><div class="goal-fill" style="width:${completeness}%;background:${completeness >= 100 ? "linear-gradient(90deg,var(--accent),#0bbf6a)" : "linear-gradient(90deg,var(--brand),var(--brand-dark))"}">${completeness >= 12 ? completeness + "%" : ""}</div></div>
            <div class="check-list">
              ${checklist.map(([label, ok, link]) => `<div class="check-row ${ok ? "done" : ""}">
                <span class="check-ico">${ok ? "✓" : ""}</span><span>${UI.esc(label)}</span>${ok ? "" : `<a href="${link}">Compléter</a>`}</div>`).join("")}
            </div>
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>Avis à traiter ${pendingReviews.length ? `<span class="ss-badge" style="position:static;margin:0 0 0 6px">${pendingReviews.length}</span>` : ""}</h3></div>
            ${pendingReviews.length ? pendingReviews.slice(0, 5).map((r) => `<div style="padding:9px 0;border-bottom:1px solid var(--border)">
                <div class="flex-between"><strong style="font-size:13.5px">${UI.esc(r.userName)}</strong>${UI.starsHTML(r.rating)}</div>
                <div class="text-muted" style="font-size:12.5px">${r._store ? "Boutique" : "Article : " + UI.esc(r._ptitle)} · ${UI.timeAgo(r.createdAt)}</div>
                ${r.comment ? `<div style="font-size:13px;margin-top:3px">${UI.esc(r.comment)}</div>` : ""}
                <a href="${r._store ? "#/store/" + store.id : "#/product/" + r._pid}" style="font-size:12.5px;color:var(--brand);font-weight:700">Répondre →</a>
              </div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:16px 0">✅ Vous avez répondu à tous les avis.</p>`}
          </div>
        </div>

        ${(outStock.length || lowStock.length) ? `<div class="card card-pad mt-16" style="border-color:var(--warning)">
          <div class="panel-head"><h3>⚠️ Alertes de stock</h3><a href="#/seller/products">Gérer →</a></div>
          ${outStock.map((p) => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
            <a href="#/seller/product/${p.id}/edit" style="font-weight:600">${UI.esc(p.title)}</a><span class="status annulee">Rupture</span></div>`).join("")}
          ${lowStock.map((p) => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
            <a href="#/seller/product/${p.id}/edit" style="font-weight:600">${UI.esc(p.title)}</a><span class="status unpublished">Stock faible : ${p.stock}</span></div>`).join("")}
        </div>` : ""}

        ${tips.length ? `<div class="card card-pad mt-16">
          <div class="panel-head"><h3>💡 Conseils pour booster votre boutique</h3></div>
          ${tips.slice(0, 4).map(([emo, txt, link]) => `<a href="${link}" class="tip-row"><span class="tip-emo">${emo}</span><span>${UI.esc(txt)}</span><span class="tip-arrow">→</span></a>`).join("")}
        </div>` : ""}

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>Articles les plus vus</h3><a href="#/seller/products">Gérer →</a></div>
            ${topViewed.length ? `<table class="data-table">
              <thead><tr><th>Article</th><th>Vues</th><th>Stock</th><th>Statut</th></tr></thead>
              <tbody>${topViewed.map((p) => `<tr>
                <td><a href="#/product/${p.id}" style="font-weight:600">${UI.esc(p.title)}</a></td>
                <td>👁️ ${p.views || 0}</td><td>${p.stock}</td>
                <td><span class="status ${p.status}">${statusLabel(p.status)}</span></td>
              </tr>`).join("")}</tbody></table>`
              : `<p class="text-muted" style="text-align:center;padding:16px 0">Aucun article. <a href="#/seller/product/new" style="color:var(--brand);font-weight:700">Ajoutez-en un</a>.</p>`}
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>Dernières commandes</h3><a href="#/seller/orders">Tout voir →</a></div>
            ${recentOrders.length ? recentOrders.map((o) => `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div><strong style="font-size:13.5px">${UI.esc(o.number)}</strong><div class="text-muted" style="font-size:12px">${UI.esc(o.buyerName)} · ${UI.timeAgo(o.createdAt)}</div></div>
                <div style="text-align:right"><span class="status ${o.status}">${Orders.STATUS[o.status]}</span><div style="font-weight:800;color:var(--brand);font-size:13.5px;margin-top:3px">${UI.fcfa(o.total)}</div></div>
              </div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:16px 0">Aucune commande pour le moment.</p>`}
          </div>
        </div>`,
    });

    const shareBtn = document.getElementById("shareStoreBtn");
    if (shareBtn) shareBtn.addEventListener("click", () => shareStore(store));
    const qrBtn = document.getElementById("qrBtn");
    if (qrBtn) qrBtn.addEventListener("click", () => showStoreQR(store));
    const announceBtn = document.getElementById("announceBtn");
    if (announceBtn) announceBtn.addEventListener("click", () => openAnnounceModal(store));
  }

  /** Envoi d'une annonce (notification) à tous les abonnés de la boutique. */
  function openAnnounceModal(store) {
    const subs = Store.subscriberCount(store.id);
    const presets = [
      ["🔥 Vente flash", "🔥 Vente flash chez " + store.name + " ! Profitez de nos promotions dès maintenant."],
      ["✨ Nouveautés", "✨ De nouveaux articles viennent d'arriver chez " + store.name + ". Venez les découvrir !"],
      ["📦 Réassort", "📦 Vos articles préférés sont de nouveau en stock chez " + store.name + " !"],
    ];
    UI.modal({
      title: "📣 Annonce aux abonnés",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Votre message sera envoyé en notification à vos <strong>${subs} abonné(s)</strong>.</p>
        ${subs === 0 ? `<div class="ci-alert alert-out" style="margin-bottom:10px">Vous n'avez pas encore d'abonné. Partagez votre boutique pour en gagner.</div>` : ""}
        <div class="chips-row" style="margin-bottom:10px">${presets.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${p[0]}</button>`).join("")}</div>
        <div class="field"><label>Message</label><textarea id="anMsg" rows="3" placeholder="Écrivez votre annonce…"></textarea></div>
        <div class="field mt-8"><label>Lien (optionnel)</label>
          <select id="anLink"><option value="#/store/${store.id}">Ma vitrine</option><option value="#/deals">Bons plans</option></select></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="anGo" ${subs === 0 ? "disabled" : ""}>Envoyer l'annonce</button>`,
      onMount(m, close) {
        m.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { m.querySelector("#anMsg").value = presets[Number(b.getAttribute("data-preset"))][1]; }));
        m.querySelector("#anGo").addEventListener("click", () => {
          const msg = m.querySelector("#anMsg").value.trim();
          if (!msg) { UI.toast("Écrivez un message.", "error"); return; }
          Notifications.notifySubscribers(store.id, { type: "new_product", message: "📣 " + msg, link: m.querySelector("#anLink").value });
          close();
          UI.toast(`Annonce envoyée à ${subs} abonné(s) ✓`, "success");
        });
      },
    });
  }

  function statCard(ic, emoji, val, lbl) {
    return `<div class="stat-card"><div class="stat-ico ${ic}" style="font-size:20px">${emoji}</div>
      <div class="stat-val">${val}</div><div class="stat-lbl">${UI.esc(lbl)}</div></div>`;
  }

  // Jeu d'icônes SVG pour le back-office vendeur.
  const SICON = {
    dash: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10 3h8v5h-8z'/></svg>",
    box: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.2 6.1 3L12 12.3 5.9 7.2zM5 8.9l6 3v7.2l-6-3zm14 0v7.2l-6 3v-7.2z'/></svg>",
    receipt: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M6 2h12a1 1 0 0 1 1 1v19l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1zm2 5v2h8V7zm0 4v2h8v-2z'/></svg>",
    store: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M4 4h16l1 5-2 1v10H5V10L3 9zm3 8v6h4v-4h2v4h4v-6z'/></svg>",
    eye: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'/></svg>",
    plus: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z'/></svg>",
    back: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z'/></svg>",
    pencil: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z'/></svg>",
    trash: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M6 7h12l-1 14H7zM9 4h6l1 2H8z'/></svg>",
    menu: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z'/></svg>",
    wa: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.9.9-2.7-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 6 8.9c0 1.8 1.3 3.5 1.5 3.7s2.6 4 6.3 5.4c2.2.8 2.6.6 3.1.6s1.4-.6 1.6-1.1.2-1 .1-1.1-.3-.2-.5-.3z'/></svg>",
    copy: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z'/></svg>",
    printer: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM18 3H6v4h12z'/></svg>",
    download: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 3v10l3.5-3.5L17 11l-5 5-5-5 1.5-1.5L12 13V3zM5 19h14v2H5z'/></svg>",
    chart: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z'/></svg>",
    users: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-2.7 0-8 1.3-8 4v3h8v-3c0-1 .4-1.9 1-2.6A11 11 0 0 0 8 13zm8 0c-.5 0-1.1 0-1.7.1A5 5 0 0 1 18 17v3h6v-3c0-2.7-5.3-4-8-4z'/></svg>",
    tag: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z'/></svg>",
    chat: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7zm0 4h7v2H7z'/></svg>",
    star: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 17.3 6.2 21l1.5-6.6L2.5 9.9l6.7-.6L12 3l2.8 6.3 6.7.6-5.2 4.5L17.8 21z'/></svg>",
  };

  // Réponses rapides (modèles) pour la messagerie vendeur.
  const QUICK_REPLIES = [
    "Bonjour, oui c'est disponible ✅",
    "Merci pour votre message 🙏",
    "Le prix est négociable, faites une offre.",
    "Livraison possible dès demain.",
    "Paiement à la livraison uniquement.",
    "Désolé, article en rupture pour le moment.",
  ];

  /**
   * Rend la barre de menu basse propre au vendeur (mobile). Distincte de la
   * nav client : fond sombre, bouton central « + » et un menu « Plus ».
   * @param {string} active clé de la page active
   */
  function renderSellerBottomNav(active) {
    const el = document.getElementById("sellerBottomNav");
    if (!el) return;
    const store = sellerStore();
    if (!store) { el.innerHTML = ""; return; }
    const pending = Orders.byStore(store.id).filter((o) => o.status === "en_attente").length;
    el.innerHTML = `
      <a class="sbn-item ${active === "dashboard" ? "active" : ""}" href="#/seller/dashboard">${SICON.dash}<span>Tableau</span></a>
      <a class="sbn-item ${active === "products" ? "active" : ""}" href="#/seller/products">${SICON.box}<span>Articles</span></a>
      <a class="sbn-fab" href="#/seller/product/new" aria-label="Nouvel article">${SICON.plus}</a>
      <a class="sbn-item ${active === "orders" ? "active" : ""}" href="#/seller/orders">${SICON.receipt}<span>Commandes</span>${pending ? `<span class="badge">${pending > 99 ? "99+" : pending}</span>` : ""}</a>
      <button class="sbn-item" id="sbnMore" type="button">${SICON.menu}<span>Menu</span></button>`;
    const more = document.getElementById("sbnMore");
    if (more) more.addEventListener("click", openSellerMenu);
  }

  /** Feuille « Menu » du vendeur : accès profil, vitrine, accueil, notifs… */
  function openSellerMenu() {
    const store = sellerStore();
    const user = Auth.current();
    const items = [
      ["#/seller/store", "🏪", "Ma boutique (infos)"],
      ["#/store/" + store.id, "👁️", "Voir ma vitrine"],
      ["#/seller/product/new", "➕", "Ajouter un article"],
      ["#/seller/inventory", "📊", "Inventaire"],
      ["#/seller/orders", "🧾", "Mes commandes"],
      ["#/seller/promos", "🏷️", "Codes promo"],
      ["#/seller/reviews", "⭐", "Avis clients"],
      ["#/seller/messages", "💬", "Messages"],
      ["#/seller/stats", "📊", "Statistiques"],
      ["#/seller/clients", "👥", "Mes clients"],
      ["#/", "🛒", "Accueil de la marketplace"],
      ["#/profile", "👤", "Mon profil"],
      ["#/notifications", "🔔", "Notifications"],
    ];
    UI.modal({
      title: "Menu vendeur",
      body: `<div class="menu-sheet">
        ${items.map(([h, e, l]) => `<button class="dd-item" data-go="${h}"><span class="em">${e}</span> ${UI.esc(l)}</button>`).join("")}
        <div class="divider" style="margin:6px 0"></div>
        <button class="dd-item danger" id="smLogout"><span class="em">↪</span> Se déconnecter</button>
      </div>`,
      onMount(m, close) {
        m.querySelectorAll("[data-go]").forEach((b) =>
          b.addEventListener("click", () => { close(); Router.go(b.getAttribute("data-go")); })
        );
        const lo = m.querySelector("#smLogout");
        if (lo) lo.addEventListener("click", () => { close(); Auth.logout(); renderHeaderUser(); UI.refreshBadges(); UI.toast("Déconnecté.", "info"); Router.go("#/"); });
      },
    });
  }

  /**
   * Coquille dédiée à l'espace vendeur (back-office) : sidebar sombre + zone
   * de travail. Rend l'espace vendeur clairement distinct de l'espace client.
   * @param {object} opts { active, title, subtitle, actions(HTML), body(HTML) }
   */
  function sellerLayout(opts) {
    const store = sellerStore();
    const pending = store ? Orders.byStore(store.id).filter((o) => o.status === "en_attente").length : 0;
    const msgUnread = store ? Messages.unreadForSeller(store.id) : 0;
    const badges = { orders: pending, messages: msgUnread };
    const nav = [
      ["dashboard", "Tableau de bord", "#/seller/dashboard", SICON.dash],
      ["products", "Mes articles", "#/seller/products", SICON.box],
      ["inventory", "Inventaire", "#/seller/inventory", SICON.chart],
      ["orders", "Commandes", "#/seller/orders", SICON.receipt],
      ["promos", "Promotions", "#/seller/promos", SICON.tag],
      ["reviews", "Avis", "#/seller/reviews", SICON.star],
      ["messages", "Messages", "#/seller/messages", SICON.chat],
      ["stats", "Statistiques", "#/seller/stats", SICON.chart],
      ["clients", "Clients", "#/seller/clients", SICON.users],
      ["store", "Ma boutique", "#/seller/store", SICON.store],
    ];
    const navHTML = nav.map(([k, l, h, ic]) => `
      <a href="${h}" class="ss-item ${opts.active === k ? "active" : ""}">
        <span class="ss-ico">${ic}</span><span>${l}</span>
        ${badges[k] ? `<span class="ss-badge">${badges[k]}</span>` : ""}
      </a>`).join("");

    V().innerHTML = `
      <div class="seller-shell">
        <aside class="seller-sidebar">
          <div class="ss-brand">
            <img src="${UI.safeImg(store.logo, store.name)}" alt="" />
            <div><div class="ss-name">${UI.esc(store.name)}</div><div class="ss-role">Espace vendeur</div></div>
          </div>
          <nav class="ss-nav">${navHTML}</nav>
          <div class="ss-foot">
            <a href="#/store/${store.id}" class="ss-link ss-link-accent">${SICON.eye}<span>Voir ma vitrine</span></a>
            <a href="#/" class="ss-link">${SICON.back}<span>Retour à la marketplace</span></a>
          </div>
        </aside>
        <div class="seller-main">
          <header class="seller-topbar">
            <div><h1 class="st-title">${UI.esc(opts.title)}</h1>${opts.subtitle ? `<div class="st-sub">${opts.subtitle}</div>` : ""}</div>
            <div class="st-actions">${opts.actions || ""}</div>
          </header>
          <div class="seller-content">${opts.body}</div>
        </div>
      </div>`;
    SB().innerHTML = "";
    clearPageTimers();
    renderSellerBottomNav(opts.active);
    renderCompareBar();
  }

  function statusLabel(s) {
    return { published: "Publié", scheduled: "Programmé", draft: "Brouillon", unpublished: "Dépublié" }[s] || s;
  }

  /* ============================================================
     VENDEUR : innovations (analytics, partage, impression, export…)
     ============================================================ */
  const LOW_STOCK = 3; // seuil d'alerte de stock faible

  /** Histogramme simple (barres CSS) : data = [{label, value}]. */
  function barChartHTML(data) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return `<div class="chart-bars">${data.map((d) => {
      const h = Math.round((d.value / max) * 100);
      return `<div class="cb-col" title="${UI.esc(d.label)} : ${UI.fcfa(d.value)}">
        <div class="cb-track"><div class="cb-bar" style="height:${d.value > 0 ? Math.max(4, h) : 0}%"></div></div>
        <div class="cb-lbl">${UI.esc(d.label)}</div></div>`;
    }).join("")}</div>`;
  }

  /** Donut (conic-gradient) : segments = [{label, value, color}]. */
  function donutHTML(segments, centerVal, centerSub) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    let acc = 0;
    const stops = total > 0 ? segments.filter((s) => s.value > 0).map((s) => {
      const a = (acc / total) * 360; acc += s.value; const b = (acc / total) * 360;
      return `${s.color} ${a}deg ${b}deg`;
    }).join(", ") : "var(--surface-3) 0deg 360deg";
    const legend = segments.map((s) => `<div class="donut-leg"><span class="dot" style="background:${s.color}"></span>${UI.esc(s.label)} <strong>${s.value}</strong></div>`).join("");
    return `<div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})"><div class="donut-hole">
        <div class="donut-val">${centerVal}</div><div class="donut-sub">${UI.esc(centerSub)}</div></div></div>
      <div class="donut-legend">${legend}</div></div>`;
  }

  /** Ventes des 7 derniers jours à partir des commandes. */
  function last7DaysSales(orders) {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      const value = orders.filter((o) => o.createdAt >= start && o.createdAt < end).reduce((s, o) => s + o.total, 0);
      days.push({ label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), value });
    }
    return days;
  }

  /** Total des ventes du mois courant. */
  function monthSales(orders) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return orders.filter((o) => o.createdAt >= start).reduce((s, o) => s + o.total, 0);
  }

  /** Ouvre WhatsApp (sélecteur de contact) avec un texte pré-rempli. */
  function waShare(text) {
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  /** Copie du texte dans le presse-papiers (avec repli pour file://). */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function shareProduct(p) {
    const store = Store.get(p.storeId);
    const price = Products.effectivePrice(p);
    const txt = `🛍️ ${p.title}\n💰 ${UI.fcfa(price)}\n🏪 ${store.name} — 📍 ${store.commune}\n💵 Paiement à la livraison sur Marché CI.`;
    waShare(txt);
  }

  function shareStore(store) {
    const n = Products.byStore(store.id).length;
    const txt = `🏪 Découvrez ma boutique « ${store.name} » sur Marché CI !\n${n} article(s) disponibles.\n📍 ${store.commune} · 💵 Paiement à la livraison.`;
    waShare(txt);
  }

  /** Duplique un article (en brouillon) pour créer une variante rapidement. */
  function duplicateProduct(id, after) {
    const p = Products.get(id);
    if (!p) return;
    const copy = Object.assign({}, p, { title: p.title + " (copie)", status: "draft" });
    delete copy.id; delete copy.views; delete copy.createdAt;
    const res = Products.create(copy);
    if (res.ok) { UI.toast("Article dupliqué (brouillon) ✓", "success"); if (after) after(); }
    else UI.toast(res.error, "error");
  }

  /** Bon de livraison imprimable (paiement à la livraison). */
  function printDeliverySlip(order) {
    const store = Store.get(order.storeId);
    const itemsTotal = order.itemsTotal != null ? order.itemsTotal : order.total;
    const rows = order.items.map((it) => {
      const v = [it.variant && it.variant.size, it.variant && it.variant.color].filter(Boolean).join(" / ");
      return `<tr><td>${UI.esc(it.title)}${v ? ` <small>(${UI.esc(v)})</small>` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${UI.fcfa(it.unit * it.qty)}</td></tr>`;
    }).join("") +
      `<tr><td colspan="2" style="text-align:right">Sous-total articles</td><td style="text-align:right">${UI.fcfa(itemsTotal)}</td></tr>` +
      `<tr><td colspan="2" style="text-align:right">Livraison (${UI.esc(order.delivery.commune)})</td><td style="text-align:right">${order.deliveryFee ? UI.fcfa(order.deliveryFee) : "Gratuite"}</td></tr>`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Bon de livraison ${UI.esc(order.number)}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:28px;max-width:720px;margin:auto}
        h1{font-size:20px;margin:0} .muted{color:#666;font-size:13px}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #f97316;padding-bottom:12px;margin-bottom:16px}
        .badge{background:#f97316;color:#fff;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px}
        table{width:100%;border-collapse:collapse;margin:14px 0}
        th,td{border-bottom:1px solid #ddd;padding:9px 8px;font-size:14px} th{text-align:left;background:#faf6f2}
        .box{border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0}
        .total{font-size:20px;font-weight:800;color:#ea580c}
        .cod{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;font-size:14px}
        @media print{button{display:none}}
      </style></head><body>
      <div class="head"><div><h1>🛒 ${UI.esc(store.name)}</h1><div class="muted">Bon de livraison · Marché CI</div></div>
        <div style="text-align:right"><div class="badge">N° ${UI.esc(order.number)}</div><div class="muted" style="margin-top:6px">${UI.dateFR(order.createdAt)}</div></div></div>
      <div class="box"><strong>Livrer à :</strong><br>${UI.esc(order.delivery.name)} — ${UI.esc(order.delivery.phone)}<br>
        📍 ${UI.esc(order.delivery.commune)} — ${UI.esc(order.delivery.address)}${order.delivery.note ? `<br><em>Note : ${UI.esc(order.delivery.note)}</em>` : ""}</div>
      <table><thead><tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">Montant</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="cod">💵 <strong>Montant à encaisser à la livraison :</strong> <span class="total">${UI.fcfa(order.total)}</span><br>Mode de paiement : espèces (cash à la réception).</div>
      <p class="muted" style="margin-top:18px">Merci de vérifier le contenu du colis à la réception. — ${UI.esc(store.name)}</p>
      <button onclick="window.print()" style="margin-top:10px;padding:10px 18px;border:none;background:#f97316;color:#fff;border-radius:8px;font-weight:700;cursor:pointer">Imprimer</button>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { UI.toast("Autorisez les fenêtres pop-up pour imprimer.", "error"); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
  }

  /** Rapport de statistiques imprimable (PDF via impression navigateur). */
  function printStatsReport(store, s) {
    const periodLabel = { "7d": "7 derniers jours", "30d": "30 derniers jours", month: "Ce mois" }[s.period] || "";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rapport — ${UI.esc(store.name)}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:30px;max-width:760px;margin:auto}
        h1{font-size:22px;margin:0} .muted{color:#666} .head{border-bottom:3px solid #f97316;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}
        .kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0}
        .kpi{border:1px solid #ddd;border-radius:10px;padding:12px 14px} .kpi b{font-size:22px} .kpi span{color:#666;font-size:13px;display:block}
        table{width:100%;border-collapse:collapse;margin:8px 0 18px} th,td{border-bottom:1px solid #eee;padding:7px;text-align:left;font-size:14px}
        h3{margin:16px 0 6px} @media print{button{display:none}}</style></head><body>
      <div class="head"><div><h1>🛒 ${UI.esc(store.name)}</h1><div class="muted">Rapport de performance — ${periodLabel}</div></div>
        <div class="muted">${UI.dateFR(Date.now())}</div></div>
      <div class="kpis">
        <div class="kpi"><b>${UI.fcfa(s.caCur)}</b><span>Ventes</span></div>
        <div class="kpi"><b>${s.count}</b><span>Commandes</span></div>
        <div class="kpi"><b>${UI.fcfa(s.avg)}</b><span>Panier moyen</span></div>
        <div class="kpi"><b>${s.delivRate}%</b><span>Taux de livraison</span></div>
        <div class="kpi"><b>${UI.fcfa(s.collected)}</b><span>Déjà encaissé</span></div>
        <div class="kpi"><b>${UI.fcfa(s.toCollect)}</b><span>Reste à encaisser</span></div>
        <div class="kpi"><b>${UI.fcfa(s.grossMargin || 0)}</b><span>Marge brute</span></div>
        <div class="kpi"><b>${UI.fcfa(s.netProfit || 0)}</b><span>Bénéfice net (− ${UI.fcfa(s.expensesPeriod || 0)} de charges)</span></div>
      </div>
      <h3>Top articles vendus</h3>
      <table><tbody>${s.topProducts.length ? s.topProducts.map(([t, n]) => `<tr><td>${UI.esc(t)}</td><td style="text-align:right">${n}</td></tr>`).join("") : "<tr><td>—</td></tr>"}</tbody></table>
      <h3>Top communes</h3>
      <table><tbody>${s.topCommunes.length ? s.topCommunes.map(([c, n]) => `<tr><td>${UI.esc(c)}</td><td style="text-align:right">${n} commande(s)</td></tr>`).join("") : "<tr><td>—</td></tr>"}</tbody></table>
      <p class="muted" style="margin-top:20px">Généré par Marché CI · Taux d'annulation : ${s.cancelRate}%</p>
      <button onclick="window.print()" style="padding:10px 18px;border:none;background:#f97316;color:#fff;border-radius:8px;font-weight:700;cursor:pointer">Imprimer / PDF</button>
      </body></html>`;
    const wnd = window.open("", "_blank");
    if (!wnd) { UI.toast("Autorisez les pop-up pour imprimer.", "error"); return; }
    wnd.document.write(html); wnd.document.close(); setTimeout(() => wnd.print(), 350);
  }

  /** Facture / reçu imprimable (PDF via impression) d'une commande. */
  function printInvoice(order) {
    const store = Store.get(order.storeId);
    const itemsTotal = order.itemsTotal != null ? order.itemsTotal : order.total;
    const rows = order.items.map((it) => {
      const v = [it.variant && it.variant.size, it.variant && it.variant.color].filter(Boolean).join(" / ");
      return `<tr><td>${UI.esc(it.title)}${v ? ` <small>(${UI.esc(v)})</small>` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${UI.fcfa(it.unit)}</td><td style="text-align:right">${UI.fcfa(it.unit * it.qty)}</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${UI.esc(order.number)}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:30px;max-width:720px;margin:auto}
        h1{font-size:20px;margin:0} .muted{color:#666;font-size:13px}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #f97316;padding-bottom:12px;margin-bottom:16px}
        .badge{background:#0f9d58;color:#fff;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px}
        table{width:100%;border-collapse:collapse;margin:14px 0} th,td{border-bottom:1px solid #eee;padding:8px;font-size:14px} th{text-align:left;background:#faf6f2}
        .tot{display:flex;justify-content:flex-end} .tot table{width:auto;min-width:280px}
        .grand td{font-size:18px;font-weight:800;border-top:2px solid #333} @media print{button{display:none}}</style></head><body>
      <div class="head"><div><h1>🛒 ${UI.esc(store.name)}</h1><div class="muted">Reçu / facture · Marché CI</div></div>
        <div style="text-align:right"><div class="badge">${UI.esc(order.number)}</div><div class="muted" style="margin-top:6px">${UI.dateFR(order.createdAt)}</div></div></div>
      <div class="muted"><strong>Client :</strong> ${UI.esc(order.delivery.name)} — ${UI.esc(order.delivery.phone)}<br>${UI.esc(order.delivery.commune)} — ${UI.esc(order.delivery.address)}</div>
      <table><thead><tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">P.U.</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><table>
        <tr><td>Sous-total</td><td style="text-align:right">${UI.fcfa(itemsTotal)}</td></tr>
        ${order.discount ? `<tr><td>Remise ${order.couponCode ? "(" + UI.esc(order.couponCode) + ")" : ""}</td><td style="text-align:right">− ${UI.fcfa(order.discount)}</td></tr>` : ""}
        <tr><td>Livraison</td><td style="text-align:right">${order.deliveryFee ? UI.fcfa(order.deliveryFee) : "Gratuite"}</td></tr>
        <tr class="grand"><td>Total ${order.paid ? "(payé)" : "à payer"}</td><td style="text-align:right">${UI.fcfa(order.total)}</td></tr>
      </table></div>
      <p class="muted">Paiement à la livraison (espèces). Merci de votre confiance — ${UI.esc(store.name)}.${store.returnPolicy ? "<br>Retour : " + UI.esc(store.returnPolicy) : ""}</p>
      <button onclick="window.print()" style="padding:10px 18px;border:none;background:#f97316;color:#fff;border-radius:8px;font-weight:700;cursor:pointer">Imprimer / PDF</button>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { UI.toast("Autorisez les pop-up pour imprimer.", "error"); return; }
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 350);
  }

  /** Export CSV des commandes d'une boutique. */
  function exportOrdersCSV(store, orders) {
    if (!orders.length) { UI.toast("Aucune commande à exporter.", "info"); return; }
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const header = ["N°", "Date", "Client", "Téléphone", "Commune", "Adresse", "Articles", "Total (FCFA)", "Statut", "Paiement"];
    const lines = orders.map((o) => [
      o.number, new Date(o.createdAt).toLocaleString("fr-FR"), o.buyerName, o.delivery.phone,
      o.delivery.commune, o.delivery.address,
      o.items.map((i) => `${i.title} x${i.qty}`).join(" ; "),
      o.total, Orders.STATUS[o.status], "Livraison (espèces)",
    ].map(esc).join(","));
    const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n"); // BOM pour Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = store.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    a.href = url; a.download = "commandes-" + (slug || "boutique") + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast("Export CSV téléchargé ✓", "success");
  }

  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  }

  /** Télécharge un objet en fichier JSON. */
  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Exporte le catalogue (articles) de la boutique en JSON. */
  function exportCatalog(store) {
    const products = Products.byStore(store.id, true).map((p) => ({
      title: p.title, description: p.description, price: p.price, promoPrice: p.promoPrice,
      stock: p.stock, category: p.category, condition: p.condition, status: p.status,
      featured: p.featured, images: p.images, variants: p.variants,
    }));
    downloadJSON("catalogue-" + (slugify(store.name) || "boutique") + ".json", { store: store.name, exportedAt: Date.now(), products });
    UI.toast(`Catalogue exporté (${products.length} articles) ✓`, "success");
  }

  /** Modale d'import de catalogue (JSON) : fichier ou collage. */
  function openImportCatalog() {
    UI.modal({
      title: "Importer un catalogue",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Importez des articles depuis un fichier <strong>.json</strong> (exporté depuis Marché CI) ou <strong>.csv</strong>, ou collez le contenu. Les articles sont ajoutés en <strong>brouillon</strong>.</p>
        <div class="field"><label>Fichier (.json ou .csv)</label><input type="file" id="impFile" accept="application/json,.json,.csv,text/csv" /></div>
        <div class="field mt-8"><label>ou coller le contenu</label><textarea id="impText" placeholder='JSON : {"products":[…]}  —  CSV : titre,prix,stock,categorie,description' style="min-height:120px;font-family:monospace;font-size:12px"></textarea></div>
        <div class="text-muted" style="font-size:12px">CSV — colonnes reconnues : <code>titre, prix, stock, categorie, description, cout, etat, tags</code> (1re ligne = en-têtes).</div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="impGo">Importer</button>`,
      onMount(m, close) {
        m.querySelector("#impFile").addEventListener("change", (e) => {
          const f = e.target.files[0]; if (!f) return;
          const r = new FileReader(); r.onload = () => { m.querySelector("#impText").value = r.result; }; r.readAsText(f);
        });
        m.querySelector("#impGo").addEventListener("click", () => {
          const raw = m.querySelector("#impText").value.trim();
          if (!raw) { UI.toast("Aucun contenu à importer.", "error"); return; }
          let arr;
          if (raw[0] === "{" || raw[0] === "[") {
            try { const data = JSON.parse(raw); arr = Array.isArray(data) ? data : (data.products || []); }
            catch (e) { UI.toast("JSON invalide.", "error"); return; }
          } else {
            arr = parseCSVProducts(raw);
          }
          if (!arr || !arr.length) { UI.toast("Aucun article trouvé.", "error"); return; }
          let n = 0;
          arr.forEach((it) => {
            if (!it || !it.title) return;
            const res = Products.create(Object.assign({ status: "draft" }, it));
            if (res.ok) n++;
          });
          close();
          UI.toast(`${n} article(s) importé(s) (brouillon) ✓`, "success");
          if (location.hash.indexOf("#/seller/products") === 0) Router.resolve();
        });
      },
    });
  }

  /** Parse un CSV simple en objets article (en-têtes FR tolérants). */
  function parseCSVProducts(text) {
    const rows = csvRows(text);
    if (rows.length < 2) return [];
    const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const headers = rows[0].map(norm);
    const idx = (names) => headers.findIndex((h) => names.includes(h));
    const iTitle = idx(["titre", "title", "nom"]);
    const iPrice = idx(["prix", "price"]);
    const iStock = idx(["stock", "quantite", "qte"]);
    const iCat = idx(["categorie", "category", "cat"]);
    const iDesc = idx(["description", "desc"]);
    const iCost = idx(["cout", "cost", "prix achat"]);
    const iCond = idx(["etat", "condition"]);
    const iTags = idx(["tags", "mots-cles", "etiquettes"]);
    const catByLabel = (v) => { const n = norm(v); const c = UI.CATEGORIES.find((x) => norm(x.label) === n || x.id === n); return c ? c.id : "mode"; };
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row.length || (iTitle >= 0 && !String(row[iTitle] || "").trim())) continue;
      out.push({
        title: iTitle >= 0 ? row[iTitle] : row[0],
        price: iPrice >= 0 ? row[iPrice] : 0,
        stock: iStock >= 0 ? row[iStock] : 1,
        category: iCat >= 0 ? catByLabel(row[iCat]) : "mode",
        description: iDesc >= 0 ? row[iDesc] : "",
        cost: iCost >= 0 ? row[iCost] : 0,
        condition: iCond >= 0 && norm(row[iCond]) === "occasion" ? "occasion" : "neuf",
        tags: iTags >= 0 ? String(row[iTags] || "").split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [],
      });
    }
    return out;
  }

  /** Découpe un CSV (gère les guillemets et séparateurs , ou ;). */
  function csvRows(text) {
    const firstLine = text.slice(0, text.indexOf("\n") < 0 ? text.length : text.indexOf("\n"));
    const sep = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
    const rows = []; let row = [], cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === sep) { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  /** Sauvegarde complète de toutes les données locales (JSON). */
  function exportBackup() {
    const data = {};
    Object.values(DB.KEYS).forEach((k) => (data[k] = DB.get(k, null)));
    downloadJSON("marchesci-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json", { app: "MarcheCI", version: 1, at: Date.now(), data });
    UI.toast("Sauvegarde complète téléchargée ✓", "success");
  }

  /** Restauration d'une sauvegarde complète. */
  function openRestoreBackup() {
    UI.modal({
      title: "Restaurer une sauvegarde",
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">⚠️ La restauration <strong>remplace toutes les données actuelles</strong> (boutiques, articles, commandes…). Choisissez un fichier de sauvegarde Marché CI.</p>
        <div class="field"><label>Fichier de sauvegarde (.json)</label><input type="file" id="rsFile" accept="application/json,.json" /></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-danger" id="rsGo">Restaurer</button>`,
      onMount(m, close) {
        let payload = null;
        m.querySelector("#rsFile").addEventListener("change", (e) => {
          const f = e.target.files[0]; if (!f) return;
          const r = new FileReader(); r.onload = () => { try { payload = JSON.parse(r.result); } catch (x) { payload = null; UI.toast("Fichier invalide.", "error"); } }; r.readAsText(f);
        });
        m.querySelector("#rsGo").addEventListener("click", async () => {
          if (!payload || !payload.data) { UI.toast("Sélectionnez un fichier valide.", "error"); return; }
          Object.keys(payload.data).forEach((k) => { if (payload.data[k] != null) DB.set(k, payload.data[k]); });
          close();
          UI.toast("Sauvegarde restaurée ✓", "success");
          renderHeaderUser(); UI.refreshBadges(); Router.go("#/seller/dashboard");
        });
      },
    });
  }

  /* ---------- QR code (générateur autonome, pur JS) ---------- */

  /** Affiche le QR code de la boutique dans une modale. */
  function showStoreQR(store) {
    const text = "Marché CI — Boutique : " + store.name + " | " + store.commune + " | WhatsApp : " + (store.whatsapp || "-");
    let qrHTML;
    try { qrHTML = MPQR.svg(text, 4); }
    catch (e) { qrHTML = `<p class="text-muted">QR indisponible.</p>`; }
    UI.modal({
      title: "QR code de ma boutique",
      body: `<div style="text-align:center">
        <div class="qr-box" style="margin:0 auto">${qrHTML}</div>
        <p class="text-muted" style="font-size:13px;margin:14px 0 0">Imprimez-le et affichez-le dans votre point de vente : vos clients accèdent à vos infos en un scan.</p>
      </div>`,
      footer: `<button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" id="qrPrint">Imprimer</button>`,
      onMount(m, close) {
        m.querySelector("#qrPrint").addEventListener("click", () => {
          const w = window.open("", "_blank");
          if (!w) { UI.toast("Autorisez les pop-up.", "error"); return; }
          w.document.write(`<title>QR ${UI.esc(store.name)}</title><div style="text-align:center;font-family:Arial;padding:30px"><h2>${UI.esc(store.name)}</h2>${qrHTML}<p>Marché CI</p></div>`);
          w.document.close(); setTimeout(() => w.print(), 300);
        });
      },
    });
  }

  /* ============================================================
     VENDEUR : Gestion des articles
     ============================================================ */
  function viewSellerProducts(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const q = (params && params.query) || {};
    const statusFilter = ["published", "draft", "unpublished"].includes(q.status) ? q.status : "all";
    const search = (q.q || "").toLowerCase().trim();

    const products = Products.byStore(store.id, true).sort((a, b) => b.createdAt - a.createdAt);
    const counts = {
      all: products.length,
      published: products.filter((p) => p.status === "published").length,
      scheduled: products.filter((p) => p.status === "scheduled").length,
      draft: products.filter((p) => p.status === "draft").length,
      unpublished: products.filter((p) => p.status === "unpublished").length,
    };
    let list = products;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search) list = list.filter((p) => p.title.toLowerCase().includes(search));

    const tabs = [["all", "Tous"], ["published", "Publiés"], ["scheduled", "Programmés"], ["draft", "Brouillons"], ["unpublished", "Dépubliés"]];
    const qSuffix = search ? "&q=" + encodeURIComponent(search) : "";
    const filterbar = `<div class="seller-filterbar">
      <div class="tabs">${tabs.map(([k, l]) => `<a href="#/seller/products?status=${k}${qSuffix}" class="tab ${statusFilter === k ? "active" : ""}">${l}<span class="tab-count">${counts[k]}</span></a>`).join("")}</div>
      <input type="search" id="prodSearch" class="ss-search" placeholder="Rechercher un article…" value="${UI.esc(q.q || "")}" />
    </div>`;

    const bulkBar = `<div class="bulk-bar" id="bulkBar" hidden>
      <strong id="bulkCount">0</strong> sélectionné(s)
      <button class="btn btn-sm btn-accent" data-bulk="published">Publier</button>
      <button class="btn btn-sm btn-ghost" data-bulk="unpublished">Dépublier</button>
      <button class="btn btn-sm btn-ghost" data-bulk="promo">🏷️ Promo</button>
      <button class="btn btn-sm btn-ghost" data-bulk="promo-clear">Retirer promo</button>
      <button class="btn btn-sm btn-danger" data-bulk="delete">Supprimer</button>
      <button class="btn btn-sm btn-ghost" id="bulkClear" style="margin-left:auto">Désélectionner</button>
    </div>`;

    const table = list.length ? bulkBar + `<div class="table-wrap"><table class="data-table">
      <thead><tr><th style="width:34px"><input type="checkbox" id="checkAll" /></th><th>Article</th><th>Prix</th><th>Stock</th><th>Vues</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead>
      <tbody>${list.map((p) => `<tr>
        <td><input type="checkbox" class="row-check" data-check="${p.id}" /></td>
        <td><div class="flex gap-8" style="align-items:center"><img class="mini-thumb" src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/>
          <div><a href="#/product/${p.id}" style="font-weight:600">${p.featured ? `<span class="featured-star" title="À la une">★</span> ` : ""}${UI.esc(p.title)}</a>
          <div class="text-muted" style="font-size:12px">${UI.esc(UI.categoryLabel(p.category))} · ${p.condition === "occasion" ? "Occasion" : "Neuf"}${Products.promoActive(p) ? " · <span style='color:var(--danger);font-weight:700'>Promo</span>" : ""}</div></div></div></td>
        <td>${UI.fcfa(Products.effectivePrice(p))}${Products.promoActive(p) ? ` <span class="text-muted" style="text-decoration:line-through;font-size:12px">${UI.fcfa(p.price)}</span>` : ""}${p.cost ? `<div class="text-muted" style="font-size:11.5px">marge ${UI.fcfa(Products.margin(p))}</div>` : ""}</td>
        <td><input type="number" min="0" class="stock-edit ${p.stock <= 0 ? "" : ""}" data-stock="${p.id}" value="${p.stock}" title="Modifier le stock" /></td>
        <td>👁️ ${p.views || 0}</td>
        <td><span class="status ${p.status}">${statusLabel(p.status)}</span></td>
        <td><div class="row-actions">
          <a class="icon-action" href="#/product/${p.id}" title="Voir la page publique">${SICON.eye}</a>
          <button class="icon-action" data-edit="${p.id}" title="Modifier">${SICON.pencil}</button>
          <button class="icon-action ${p.featured ? "" : ""}" data-feat="${p.id}" title="${p.featured ? "Retirer de la une" : "Mettre à la une"}" style="${p.featured ? "color:#f59e0b;border-color:#f59e0b" : ""}">★</button>
          <button class="icon-action" data-share="${p.id}" title="Partager sur WhatsApp">${SICON.wa}</button>
          <button class="icon-action" data-dup="${p.id}" title="Dupliquer">${SICON.copy}</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.status === "published" ? "Dépublier" : "Publier"}</button>
          <button class="icon-action danger" data-del="${p.id}" title="Supprimer">${SICON.trash}</button>
        </div></td>
      </tr>`).join("")}</tbody></table></div>`
      : (products.length
        ? `<div class="card card-pad"><p class="text-muted" style="text-align:center;margin:0;padding:20px 0">Aucun article ne correspond à ce filtre.</p></div>`
        : emptyState("📦", "Aucun article", "Publiez votre premier article pour lancer votre boutique.", `<a href="#/seller/product/new" class="btn btn-primary">+ Nouvel article</a>`));

    sellerLayout({
      active: "products",
      title: "Mes articles",
      subtitle: `${counts.all} article(s) · ${counts.published} en ligne`,
      actions: `<button class="btn btn-ghost" id="importBtn">${SICON.download} Importer</button>
                <a href="#/seller/product/new" class="btn btn-primary">+ Nouvel article</a>`,
      body: filterbar + table,
    });

    wireProductBulk(params);

    // Recherche (Entrée pour valider).
    const si = document.getElementById("prodSearch");
    if (si) si.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = si.value.trim();
        Router.go("#/seller/products?status=" + statusFilter + (val ? "&q=" + encodeURIComponent(val) : ""));
      }
    });

    V().querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => Router.go("#/seller/product/" + b.getAttribute("data-edit") + "/edit")));
    V().querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
      const p = Products.get(b.getAttribute("data-toggle"));
      Products.update(p.id, Object.assign({}, p, { status: p.status === "published" ? "unpublished" : "published" }));
      UI.toast(p.status === "published" ? "Article dépublié." : "Article publié ✓ Vos abonnés sont notifiés.", "success");
      viewSellerProducts(params);
    }));
    V().querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (await UI.confirm("Supprimer définitivement cet article ?", { danger: true, confirmLabel: "Supprimer" })) {
        Products.remove(b.getAttribute("data-del")); UI.toast("Article supprimé.", "info"); viewSellerProducts(params);
      }
    }));
    V().querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => shareProduct(Products.get(b.getAttribute("data-share")))));
    V().querySelectorAll("[data-dup]").forEach((b) => b.addEventListener("click", () => duplicateProduct(b.getAttribute("data-dup"), () => viewSellerProducts(params))));

    // Édition rapide du stock (inline).
    V().querySelectorAll("[data-stock]").forEach((inp) => inp.addEventListener("change", () => {
      Products.quickSet(inp.getAttribute("data-stock"), { stock: Math.max(0, Math.round(Number(inp.value) || 0)) });
      UI.toast("Stock mis à jour ✓", "success");
    }));
    // Bascule « à la une ».
    V().querySelectorAll("[data-feat]").forEach((b) => b.addEventListener("click", () => {
      const p = Products.get(b.getAttribute("data-feat"));
      Products.quickSet(p.id, { featured: !p.featured });
      UI.toast(!p.featured ? "Article mis à la une ★" : "Retiré de la une.", "success");
      viewSellerProducts(params);
    }));
    // Import de catalogue.
    const imp = document.getElementById("importBtn");
    if (imp) imp.addEventListener("click", openImportCatalog);
  }

  /** Sélection multiple + actions groupées sur les articles. */
  /* ============================================================
     VENDEUR : Inventaire (valeur du stock, alertes réappro)
     ============================================================ */
  function viewSellerInventory(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const q = (params && params.query) || {};
    const threshold = store.lowStockThreshold != null ? store.lowStockThreshold : LOW_STOCK;
    const products = Products.byStore(store.id, true);
    const filter = ["all", "low", "out"].includes(q.f) ? q.f : "all";

    const withStock = products.map((p) => ({ p, stock: Products.effectiveStock(p) }));
    let list = withStock;
    if (filter === "low") list = withStock.filter((x) => x.stock > 0 && x.stock <= threshold);
    if (filter === "out") list = withStock.filter((x) => x.stock <= 0);
    list.sort((a, b) => a.stock - b.stock);

    const totalUnits = withStock.reduce((s, x) => s + x.stock, 0);
    const valueCost = withStock.reduce((s, x) => s + x.stock * (x.p.cost || 0), 0);
    const valuePrice = withStock.reduce((s, x) => s + x.stock * Products.effectivePrice(x.p), 0);
    const outCount = withStock.filter((x) => x.stock <= 0).length;
    const lowCount = withStock.filter((x) => x.stock > 0 && x.stock <= threshold).length;

    const tabs = [["all", "Tous", products.length], ["low", "Stock faible", lowCount], ["out", "Ruptures", outCount]];

    sellerLayout({
      active: "inventory",
      title: "Inventaire",
      subtitle: `${products.length} article(s) · ${totalUnits} unité(s) en stock`,
      actions: `<button class="btn btn-ghost" id="invExport">${SICON.download} Exporter (CSV)</button>`,
      body: `
        <div class="stat-grid">
          ${statCard("ic-blue", "📦", totalUnits, "Unités en stock")}
          ${statCard("ic-green", "💰", UI.fcfa(valueCost), "Valeur au coût d'achat")}
          ${statCard("ic-orange", "🏷️", UI.fcfa(valuePrice), "Valeur au prix de vente")}
          ${statCard("ic-purple", "⚠️", outCount + " / " + lowCount, "Ruptures / stock faible")}
        </div>
        <div class="card card-pad mt-16" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <label class="inline-field">Seuil d'alerte de stock faible
            <input type="number" id="invThreshold" min="0" value="${threshold}" style="width:80px" /></label>
          <button class="btn btn-ghost btn-sm" id="invSaveThreshold">Enregistrer le seuil</button>
        </div>
        <div class="seller-filterbar mt-16"><div class="tabs">${tabs.map(([k, l, c]) => `<a href="#/seller/inventory${k === "all" ? "" : "?f=" + k}" class="tab ${filter === k ? "active" : ""}">${l}<span class="tab-count">${c}</span></a>`).join("")}</div></div>
        ${list.length ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Article</th><th>Stock</th><th>Coût unit.</th><th>Valeur (coût)</th><th>Statut</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>${list.map(({ p, stock }) => {
            const state = stock <= 0 ? `<span class="status annulee">Rupture</span>` : (stock <= threshold ? `<span class="tag" style="position:static;background:var(--warning);color:#fff">Faible</span>` : `<span class="status livree">OK</span>`);
            return `<tr>
              <td><div class="flex gap-8" style="align-items:center"><img class="mini-thumb" src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/>
                <div><a href="#/product/${p.id}" style="font-weight:600">${UI.esc(p.title)}</a>${p.trackVariantStock ? `<div class="text-muted" style="font-size:11.5px">stock par variante</div>` : ""}</div></div></td>
              <td>${p.trackVariantStock ? `<strong>${stock}</strong>` : `<input type="number" min="0" class="stock-edit" data-invstock="${p.id}" value="${stock}" />`}</td>
              <td>${p.cost ? UI.fcfa(p.cost) : "—"}</td>
              <td>${UI.fcfa(stock * (p.cost || 0))}</td>
              <td>${state}</td>
              <td style="text-align:right"><a class="btn btn-ghost btn-sm" href="#/seller/product/${p.id}/edit">Réappro.</a></td>
            </tr>`;
          }).join("")}</tbody></table></div>`
          : `<div class="card card-pad"><p class="text-muted" style="text-align:center;margin:0;padding:20px 0">Aucun article dans ce filtre.</p></div>`}`,
    });

    V().querySelectorAll("[data-invstock]").forEach((inp) => inp.addEventListener("change", () => {
      Products.quickSet(inp.getAttribute("data-invstock"), { stock: Math.max(0, Math.round(Number(inp.value) || 0)) });
      UI.toast("Stock mis à jour ✓", "success"); viewSellerInventory(params);
    }));
    const saveThr = document.getElementById("invSaveThreshold");
    if (saveThr) saveThr.addEventListener("click", () => {
      Store.update(store.id, { lowStockThreshold: Math.max(0, Math.round(Number(document.getElementById("invThreshold").value) || 0)) });
      UI.toast("Seuil d'alerte enregistré ✓", "success"); viewSellerInventory(params);
    });
    const exp = document.getElementById("invExport");
    if (exp) exp.addEventListener("click", () => exportInventoryCSV(store, withStock, threshold));
  }

  /** Export CSV de l'inventaire. */
  function exportInventoryCSV(store, withStock, threshold) {
    const esc = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const header = ["Article", "Stock", "Cout unitaire", "Valeur cout", "Prix vente", "Statut"];
    const lines = withStock.map(({ p, stock }) => [p.title, stock, p.cost || 0, stock * (p.cost || 0), Products.effectivePrice(p), stock <= 0 ? "Rupture" : (stock <= threshold ? "Faible" : "OK")].map(esc).join(","));
    const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventaire-" + (slugify(store.name) || "boutique") + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    UI.toast("Inventaire exporté ✓", "success");
  }

  /* ============================================================
     VENDEUR : Avis (boutique + articles centralisés)
     ============================================================ */
  function viewSellerReviews(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const q = (params && params.query) || {};
    const filter = ["all", "pending", "reported"].includes(q.f) ? q.f : "all";
    const products = Products.byStore(store.id, true);

    // Rassemble avis boutique + avis articles.
    let all = Store.reviews(store.id).map((r) => Object.assign({ _type: "store", _targetId: store.id, _label: "Boutique" }, r));
    products.forEach((p) => { Products.reviews(p.id).forEach((r) => all.push(Object.assign({ _type: "product", _targetId: p.id, _label: p.title }, r))); });
    all.sort((a, b) => b.createdAt - a.createdAt);

    const pendingCount = all.filter((r) => !r.reply).length;
    const reportedCount = all.filter((r) => (r.reportedBy || []).length).length;
    let list = all;
    if (filter === "pending") list = all.filter((r) => !r.reply);
    if (filter === "reported") list = all.filter((r) => (r.reportedBy || []).length);

    const avg = all.length ? (all.reduce((s, r) => s + r.rating, 0) / all.length) : 0;
    const tabs = [["all", "Tous", all.length], ["pending", "Sans réponse", pendingCount], ["reported", "Signalés", reportedCount]];

    const card = (r) => `<div class="card card-pad mt-12">
        <div class="flex-between wrap">
          <div><strong>${UI.esc(r.userName || "Client")}</strong> ${UI.starsHTML(r.rating)}
            <div class="text-muted" style="font-size:12px">${UI.timeAgo(r.createdAt)} · sur <a href="${r._type === "store" ? "#/store/" + r._targetId : "#/product/" + r._targetId}">${UI.esc(r._label)}</a></div></div>
          ${(r.reportedBy || []).length ? `<span class="tag" style="position:static;background:var(--danger);color:#fff">⚑ Signalé (${r.reportedBy.length})</span>` : ""}
        </div>
        ${r.comment ? `<p style="margin:8px 0 0">${UI.esc(r.comment)}</p>` : ""}
        ${r.photo ? `<img class="review-photo" src="${UI.safeImg(r.photo, "avis")}" alt="" style="max-width:120px;margin-top:8px;border-radius:8px" />` : ""}
        ${r.reply ? `<div class="review-reply"><strong>Votre réponse :</strong> ${UI.esc(r.reply.text)}</div>`
          : `<button class="btn btn-primary btn-sm mt-8" data-reply="${r.id}" data-tid="${r._targetId}" data-ttype="${r._type}">Répondre</button>`}
      </div>`;

    sellerLayout({
      active: "reviews",
      title: "Avis clients",
      subtitle: all.length ? `Note moyenne ${avg.toFixed(1)}/5 · ${all.length} avis` : "Aucun avis pour le moment",
      body: `<div class="seller-filterbar"><div class="tabs">${tabs.map(([k, l, c]) => `<a href="#/seller/reviews${k === "all" ? "" : "?f=" + k}" class="tab ${filter === k ? "active" : ""}">${l}<span class="tab-count">${c}</span></a>`).join("")}</div></div>
        ${list.length ? list.map(card).join("") : emptyState("⭐", "Aucun avis", filter === "all" ? "Vos clients n'ont pas encore laissé d'avis." : "Rien dans ce filtre.")}`,
    });

    V().querySelectorAll("[data-reply]").forEach((b) => b.addEventListener("click", () =>
      openReplyModal(b.getAttribute("data-reply"), b.getAttribute("data-tid"), b.getAttribute("data-ttype"), () => viewSellerReviews(params))
    ));
  }

  function wireProductBulk(params) {
    const bar = document.getElementById("bulkBar");
    if (!bar) return;
    const checks = () => Array.from(V().querySelectorAll(".row-check"));
    const selected = () => checks().filter((c) => c.checked).map((c) => c.getAttribute("data-check"));
    function refresh() {
      const n = selected().length;
      bar.hidden = n === 0;
      const cnt = document.getElementById("bulkCount");
      if (cnt) cnt.textContent = n;
    }
    checks().forEach((c) => c.addEventListener("change", refresh));
    const all = document.getElementById("checkAll");
    if (all) all.addEventListener("change", () => { checks().forEach((c) => (c.checked = all.checked)); refresh(); });
    const clear = document.getElementById("bulkClear");
    if (clear) clear.addEventListener("click", () => { checks().forEach((c) => (c.checked = false)); if (all) all.checked = false; refresh(); });

    bar.querySelectorAll("[data-bulk]").forEach((b) => b.addEventListener("click", async () => {
      const ids = selected();
      if (!ids.length) return;
      const action = b.getAttribute("data-bulk");
      if (action === "delete") {
        if (!(await UI.confirm(`Supprimer ${ids.length} article(s) ?`, { danger: true, confirmLabel: "Supprimer" }))) return;
        ids.forEach((id) => Products.remove(id));
        UI.toast(`${ids.length} article(s) supprimé(s).`, "info");
        viewSellerProducts(params);
      } else if (action === "promo") {
        openBulkPromoModal(ids, () => viewSellerProducts(params));
      } else if (action === "promo-clear") {
        ids.forEach((id) => { const p = Products.get(id); if (p) Products.update(id, Object.assign({}, p, { promoPrice: 0, promoUntil: 0 })); });
        UI.toast(`Promo retirée sur ${ids.length} article(s).`, "info");
        viewSellerProducts(params);
      } else {
        ids.forEach((id) => { const p = Products.get(id); if (p) Products.update(id, Object.assign({}, p, { status: action })); });
        UI.toast(`${ids.length} article(s) ${action === "published" ? "publié(s)" : "dépublié(s)"} ✓`, "success");
        viewSellerProducts(params);
      }
    }));
  }

  /** Campagne promo groupée : applique une remise % (avec date de fin) à plusieurs articles. */
  function openBulkPromoModal(ids, after) {
    UI.modal({
      title: `🏷️ Campagne promo (${ids.length} article${ids.length > 1 ? "s" : ""})`,
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Appliquez une réduction en pourcentage à tous les articles sélectionnés. Le prix promo est calculé à partir du prix normal de chaque article.</p>
        <div class="field"><label>Réduction (%)</label><input type="number" id="bpPct" min="1" max="90" value="20" /></div>
        <div class="field mt-8"><label>Fin de la promo (optionnel)</label><input type="date" id="bpUntil" /></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="bpGo">Appliquer la promo</button>`,
      onMount(m, close) {
        m.querySelector("#bpGo").addEventListener("click", () => {
          const pct = Number(m.querySelector("#bpPct").value);
          if (!(pct > 0 && pct <= 90)) { UI.toast("Pourcentage invalide (1–90).", "error"); return; }
          const until = m.querySelector("#bpUntil").value ? new Date(m.querySelector("#bpUntil").value).getTime() : 0;
          let n = 0;
          ids.forEach((id) => {
            const p = Products.get(id); if (!p) return;
            const promoPrice = Math.max(1, Math.round(p.price * (1 - pct / 100)));
            Products.update(id, Object.assign({}, p, { promoPrice, promoUntil: until }));
            n++;
          });
          close();
          UI.toast(`Promo −${pct}% appliquée à ${n} article(s) ✓`, "success");
          if (after) after();
        });
      },
    });
  }

  /* ============================================================
     VENDEUR : Formulaire article (création / édition)
     ============================================================ */
  function viewProductForm(params) {
    if (!requireVendor()) return;
    const editing = !!params.id;
    const p = editing ? Products.get(params.id) : null;
    if (editing && !p) { layout(emptyState("😕", "Article introuvable", "")); return; }
    const store = sellerStore();
    if (editing && p.storeId !== store.id) { UI.toast("Non autorisé.", "error"); Router.go("#/seller/products"); return; }

    const d = p || {};
    const catOpts = UI.CATEGORIES.map((c) => `<option value="${c.id}" ${d.category === c.id ? "selected" : ""}>${c.icon} ${c.label}</option>`).join("");

    sellerLayout({
      active: "products",
      title: editing ? "Modifier l'article" : "Nouvel article",
      subtitle: editing ? UI.esc(p.title) : "Renseignez les informations de votre article.",
      actions: `${editing ? `<a href="#/product/${p.id}" class="btn btn-ghost">Voir la page</a>` : ""}<a href="#/seller/products" class="btn btn-ghost">Retour aux articles</a>`,
      body: `
      <div class="card card-pad" style="max-width:820px">
        <form id="prodForm" class="form-grid">
          <div class="field"><label>Images (plusieurs possibles)</label>${uploaderHTML("prodImgs", d.images || [], true)}</div>
          <div class="field"><label>Titre *</label><input id="pTitle" value="${UI.esc(d.title || "")}" required /></div>
          <div class="field"><label>Description</label><textarea id="pDesc" placeholder="Décrivez l'article…">${UI.esc(d.description || "")}</textarea></div>
          <div class="form-grid form-2col">
            <div class="field"><label>Prix (FCFA) *</label><input type="number" id="pPrice" value="${d.price || ""}" min="0" required /></div>
            <div class="field"><label>Prix promo (optionnel)</label><input type="number" id="pPromo" value="${d.promoPrice || ""}" min="0" /></div>
          </div>
          <div class="field"><label>Coût d'achat (FCFA) <span class="hint">— privé, sert au calcul de votre marge/bénéfice</span></label>
            <input type="number" id="pCost" value="${d.cost || ""}" min="0" placeholder="Ex : 12000" /></div>
          <div class="form-grid form-2col">
            <div class="field"><label>Fin de promo (optionnel) <span class="hint">— au-delà, le prix normal revient</span></label>
              <input type="date" id="pPromoUntil" value="${d.promoUntil ? new Date(d.promoUntil).toISOString().slice(0, 10) : ""}" /></div>
            <div class="field"><label>Mise en avant</label>
              <label class="switch" style="margin-top:8px"><input type="checkbox" id="pFeatured" ${d.featured ? "checked" : ""} /><span class="track"></span><span>Article « à la une » (affiché en premier)</span></label>
              <label class="switch" style="margin-top:8px"><input type="checkbox" id="pNegotiable" ${d.negotiable ? "checked" : ""} /><span class="track"></span><span>Prix négociable (le client peut faire une offre)</span></label></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Stock <span class="hint" id="stockHint">${d.trackVariantStock ? "(géré par variante ci-dessous)" : ""}</span></label><input type="number" id="pStock" value="${d.stock != null ? d.stock : 1}" min="0" ${d.trackVariantStock ? "disabled" : ""} /></div>
            <div class="field"><label>Catégorie</label><select id="pCat">${catOpts}</select></div>
          </div>
          <div class="field"><label>Réapprovisionnement prévu <span class="hint">(optionnel — affiché aux clients en cas de rupture)</span></label>
            <input type="date" id="pRestock" value="${d.restockDate ? new Date(d.restockDate).toISOString().slice(0, 10) : ""}" /></div>
          <div class="form-grid form-2col">
            <div class="field"><label>État</label><select id="pCond">
              <option value="neuf" ${d.condition !== "occasion" ? "selected" : ""}>Neuf</option>
              <option value="occasion" ${d.condition === "occasion" ? "selected" : ""}>Occasion</option>
            </select></div>
            <div class="field"><label>Statut</label><select id="pStatus">
              <option value="published" ${d.status === "published" || !editing ? "selected" : ""}>Publié</option>
              <option value="scheduled" ${d.status === "scheduled" ? "selected" : ""}>Programmé</option>
              <option value="draft" ${d.status === "draft" ? "selected" : ""}>Brouillon</option>
              <option value="unpublished" ${d.status === "unpublished" ? "selected" : ""}>Dépublié</option>
            </select></div>
          </div>
          <div class="field" id="publishAtField" ${d.status === "scheduled" ? "" : "hidden"}>
            <label>📅 Date de mise en ligne programmée</label>
            <input type="datetime-local" id="pPublishAt" value="${d.publishAt ? new Date(d.publishAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}" />
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Tailles (séparées par des virgules)</label><input id="pSizes" value="${UI.esc((d.variants && d.variants.sizes || []).join(", "))}" placeholder="S, M, L, XL" /></div>
            <div class="field"><label>Couleurs (séparées par des virgules)</label><input id="pColors" value="${UI.esc((d.variants && d.variants.colors || []).join(", "))}" placeholder="Rouge, Bleu" /></div>
          </div>
          <div class="field"><label>Mots-clés / étiquettes <span class="hint">— améliorent la recherche (séparés par des virgules)</span></label>
            <input id="pTags" value="${UI.esc((d.tags || []).join(", "))}" placeholder="wax, soirée, fait main…" /></div>
          <div class="field">
            <label class="switch"><input type="checkbox" id="pTrackVar" ${d.trackVariantStock ? "checked" : ""} /><span class="track"></span><span>Gérer le stock par variante (taille/couleur)</span></label>
            <div id="variantStockBox" class="variant-stock-box" ${d.trackVariantStock ? "" : "hidden"}></div>
          </div>
          <div class="flex gap-12">
            <button class="btn btn-primary btn-lg" type="submit">${editing ? "Enregistrer" : "Publier l'article"}</button>
            <a href="#/seller/products" class="btn btn-ghost btn-lg">Annuler</a>
          </div>
        </form>
      </div>
      ${editing && (d.history || []).length ? `<div class="card card-pad mt-16" style="max-width:820px">
        <div class="panel-head"><h3>Historique des modifications</h3></div>
        ${d.history.slice().reverse().map((h) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div class="text-muted" style="font-size:12px">${UI.dateFR(h.at)} ${new Date(h.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
          ${h.changes.map((c) => `<div style="font-size:13.5px">• ${UI.esc(c)}</div>`).join("")}</div>`).join("")}
      </div>` : ""}`,
    });

    const up = wireUploader("prodImgs", d.images || [], true);
    const parseList = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);

    // Statut « Programmé » → affiche le champ date de mise en ligne.
    const statusSel = document.getElementById("pStatus");
    statusSel.addEventListener("change", () => {
      document.getElementById("publishAtField").hidden = statusSel.value !== "scheduled";
    });

    // --- Matrice de stock par variante ---
    const existingVS = Object.assign({}, d.variantStock || {});
    function variantCombos() {
      const sizes = parseList(document.getElementById("pSizes").value);
      const colors = parseList(document.getElementById("pColors").value);
      if (sizes.length && colors.length) { const out = []; sizes.forEach((s) => colors.forEach((c) => out.push({ size: s, color: c }))); return out; }
      if (sizes.length) return sizes.map((s) => ({ size: s, color: "" }));
      if (colors.length) return colors.map((c) => ({ size: "", color: c }));
      return [];
    }
    function renderVariantStock() {
      const box = document.getElementById("variantStockBox");
      const track = document.getElementById("pTrackVar").checked;
      box.hidden = !track;
      document.getElementById("pStock").disabled = track;
      document.getElementById("stockHint").textContent = track ? "(géré par variante ci-dessous)" : "";
      if (!track) return;
      const combos = variantCombos();
      if (!combos.length) { box.innerHTML = `<p class="text-muted" style="font-size:13px;margin:8px 0 0">Ajoutez d'abord des tailles et/ou des couleurs pour définir le stock par variante.</p>`; return; }
      box.innerHTML = `<table class="variant-stock-table"><thead><tr><th>Variante</th><th>Stock</th></tr></thead><tbody>${combos.map((cb) => {
        const key = Products.variantKey(cb);
        const label = [cb.size, cb.color].filter(Boolean).join(" · ");
        return `<tr><td>${UI.esc(label)}</td><td><input type="number" min="0" class="stock-edit" data-vskey="${UI.esc(key)}" value="${existingVS[key] != null ? existingVS[key] : 0}" style="width:90px" /></td></tr>`;
      }).join("")}</tbody></table>`;
    }
    document.getElementById("pTrackVar").addEventListener("change", renderVariantStock);
    document.getElementById("pSizes").addEventListener("input", () => { if (document.getElementById("pTrackVar").checked) renderVariantStock(); });
    document.getElementById("pColors").addEventListener("input", () => { if (document.getElementById("pTrackVar").checked) renderVariantStock(); });
    renderVariantStock();

    document.getElementById("prodForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const track = document.getElementById("pTrackVar").checked;
      const variantStock = {};
      if (track) V().querySelectorAll("[data-vskey]").forEach((inp) => { variantStock[inp.getAttribute("data-vskey")] = Math.max(0, Number(inp.value) || 0); });
      const status = document.getElementById("pStatus").value;
      const publishAtVal = document.getElementById("pPublishAt").value;
      const data = {
        title: document.getElementById("pTitle").value,
        description: document.getElementById("pDesc").value,
        price: document.getElementById("pPrice").value,
        cost: document.getElementById("pCost").value,
        promoPrice: document.getElementById("pPromo").value,
        stock: document.getElementById("pStock").value,
        category: document.getElementById("pCat").value,
        condition: document.getElementById("pCond").value,
        status,
        publishAt: status === "scheduled" && publishAtVal ? new Date(publishAtVal).getTime() : 0,
        featured: document.getElementById("pFeatured").checked,
        negotiable: document.getElementById("pNegotiable").checked,
        promoUntil: document.getElementById("pPromoUntil").value ? new Date(document.getElementById("pPromoUntil").value).getTime() : 0,
        restockDate: document.getElementById("pRestock").value ? new Date(document.getElementById("pRestock").value).getTime() : 0,
        images: up.get(),
        variants: { sizes: parseList(document.getElementById("pSizes").value), colors: parseList(document.getElementById("pColors").value) },
        tags: parseList(document.getElementById("pTags").value),
        trackVariantStock: track,
        variantStock,
      };
      if (status === "scheduled" && !data.publishAt) { UI.toast("Choisissez une date de mise en ligne.", "error"); return; }
      const res = editing ? Products.update(p.id, data) : Products.create(data);
      if (res.ok) { UI.toast(editing ? "Article mis à jour ✓" : (status === "scheduled" ? "Article programmé ✓" : "Article publié ✓"), "success"); Router.go("#/seller/products"); }
      else UI.toast(res.error, "error");
    });
  }

  /* ============================================================
     VENDEUR : Commandes reçues
     ============================================================ */
  function viewSellerOrders(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const q = (params && params.query) || {};
    const filter = Orders.STATUS[q.status] ? q.status : "all";
    const period = ["today", "7d", "30d"].includes(q.period) ? q.period : "all";
    const search = (q.q || "").toLowerCase().trim();
    const orders = Orders.byStore(store.id);

    const counts = { all: orders.length };
    Object.keys(Orders.STATUS).forEach((k) => (counts[k] = orders.filter((o) => o.status === k).length));

    const now = Date.now();
    const periodMin = { today: now - 86400000, "7d": now - 7 * 86400000, "30d": now - 30 * 86400000, all: 0 }[period];
    let list = filter === "all" ? orders.slice() : orders.filter((o) => o.status === filter);
    if (period !== "all") list = list.filter((o) => o.createdAt >= periodMin);
    if (search) list = list.filter((o) => o.number.toLowerCase().includes(search) || (o.buyerName || "").toLowerCase().includes(search));

    const tabs = [["all", "Toutes"]].concat(Object.keys(Orders.STATUS).map((k) => [k, Orders.STATUS[k]]));
    // Construit une URL en conservant les filtres actifs (valeurs vides ignorées).
    const keep = (extra) => {
      const st = Object.assign({ status: filter, period, q: search }, extra);
      const p = new URLSearchParams();
      if (st.status && st.status !== "all") p.set("status", st.status);
      if (st.period && st.period !== "all") p.set("period", st.period);
      if (st.q) p.set("q", st.q);
      const qs = p.toString();
      return "#/seller/orders" + (qs ? "?" + qs : "");
    };
    const filterbar = `<div class="seller-filterbar"><div class="tabs">
        ${tabs.map(([k, l]) => `<a href="${keep({ status: k })}" class="tab ${filter === k ? "active" : ""}">${l}<span class="tab-count">${counts[k] || 0}</span></a>`).join("")}
      </div>
      <div class="flex gap-8 wrap">
        <select class="ss-search" id="ordPeriod" style="min-width:150px">
          <option value="all" ${period === "all" ? "selected" : ""}>Toute période</option>
          <option value="today" ${period === "today" ? "selected" : ""}>Aujourd'hui</option>
          <option value="7d" ${period === "7d" ? "selected" : ""}>7 derniers jours</option>
          <option value="30d" ${period === "30d" ? "selected" : ""}>30 derniers jours</option>
        </select>
        <input type="search" id="ordSearch" class="ss-search" placeholder="N° ou nom du client…" value="${UI.esc(q.q || "")}" />
      </div></div>`;

    const printable = orders.filter((o) => o.status === "confirmee").length;
    sellerLayout({
      active: "orders",
      title: "Commandes reçues",
      subtitle: `${counts.all} commande(s) · ${counts.en_attente || 0} en attente`,
      actions: `${printable ? `<button class="btn btn-ghost" id="bulkPrint">${SICON.printer} Imprimer les confirmées (${printable})</button>` : ""}
                <button class="btn btn-ghost" id="exportCsv" ${orders.length ? "" : "disabled"}>${SICON.download} Exporter (CSV)</button>`,
      body: filterbar + `<div class="text-muted" style="font-size:13px;margin:-6px 0 14px">${list.length} résultat(s)</div>` + (list.length ? list.map((o) => sellerOrderCard(o)).join("")
        : (orders.length
          ? `<div class="card card-pad"><p class="text-muted" style="text-align:center;margin:0;padding:20px 0">Aucune commande ne correspond à ces filtres.</p></div>`
          : emptyState("🧾", "Aucune commande", "Les commandes de vos clients apparaîtront ici dès le premier achat."))),
    });

    const exp = document.getElementById("exportCsv");
    if (exp) exp.addEventListener("click", () => exportOrdersCSV(store, list.length ? list : orders));
    const bulk = document.getElementById("bulkPrint");
    if (bulk) bulk.addEventListener("click", () => printMultipleSlips(orders.filter((o) => o.status === "confirmee")));
    const per = document.getElementById("ordPeriod");
    if (per) per.addEventListener("change", () => Router.go(keep({ period: per.value })));
    const os = document.getElementById("ordSearch");
    if (os) os.addEventListener("keydown", (e) => { if (e.key === "Enter") Router.go(keep({ q: os.value.trim() })); });

    V().querySelectorAll("[data-status]").forEach((sel) =>
      sel.addEventListener("change", () => {
        Orders.setStatus(sel.getAttribute("data-order"), sel.value);
        UI.toast("Statut mis à jour ✓ Le client est notifié.", "success");
        viewSellerOrders(params);
      })
    );
    V().querySelectorAll("[data-print]").forEach((b) =>
      b.addEventListener("click", () => printDeliverySlip(Orders.get(b.getAttribute("data-print"))))
    );
    V().querySelectorAll("[data-invoice]").forEach((b) =>
      b.addEventListener("click", () => printInvoice(Orders.get(b.getAttribute("data-invoice"))))
    );
    V().querySelectorAll("[data-paid]").forEach((b) =>
      b.addEventListener("click", () => {
        const o = Orders.get(b.getAttribute("data-paid"));
        Orders.setPaid(o.id, !o.paid);
        UI.toast(!o.paid ? "Marqué encaissé ✓" : "Marqué non encaissé.", "success");
        viewSellerOrders(params);
      })
    );
    // Ajustement des frais de livraison par commande (par le vendeur).
    V().querySelectorAll("[data-fee-save]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-fee-save");
        const inp = V().querySelector(`[data-fee-input="${id}"]`);
        Orders.setDeliveryFee(id, inp ? inp.value : 0);
        UI.toast("Frais de livraison mis à jour ✓ Le client est notifié.", "success");
        viewSellerOrders(params);
      })
    );
    V().querySelectorAll("[data-cancel]").forEach((b) =>
      b.addEventListener("click", () => openCancelModal(b.getAttribute("data-cancel"), "seller", () => viewSellerOrders(params)))
    );
    // Traitement des demandes de retour (accepter / refuser).
    V().querySelectorAll("[data-return-accept]").forEach((b) =>
      b.addEventListener("click", () => openResolveReturnModal(b.getAttribute("data-return-accept"), "accepted", () => viewSellerOrders(params)))
    );
    V().querySelectorAll("[data-return-refuse]").forEach((b) =>
      b.addEventListener("click", () => openResolveReturnModal(b.getAttribute("data-return-refuse"), "refused", () => viewSellerOrders(params)))
    );
  }

  /** Modale vendeur : accepter/refuser une demande de retour avec message. */
  function openResolveReturnModal(orderId, status, after) {
    UI.modal({
      title: status === "accepted" ? "✅ Accepter le retour" : "❌ Refuser le retour",
      body: `<div class="field"><label>${status === "accepted" ? "Instructions pour le client (optionnel)" : "Motif du refus (optionnel)"}</label>
        <textarea id="rrNote" placeholder="${status === "accepted" ? "Ex : renvoyez l'article à l'adresse de la boutique, remboursement à réception." : "Ex : article utilisé, hors délai…"}"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn ${status === "accepted" ? "btn-accent" : "btn-danger"}" id="rrGo">Confirmer</button>`,
      onMount(m, close) {
        m.querySelector("#rrGo").addEventListener("click", () => {
          Orders.resolveReturn(orderId, status, m.querySelector("#rrNote").value);
          UI.toast(status === "accepted" ? "Retour accepté ✓ Le client est notifié." : "Retour refusé. Le client est notifié.", "success");
          close(); if (after) after();
        });
      },
    });
  }

  function sellerOrderCard(o) {
    const opts = Object.keys(Orders.STATUS).map((k) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${Orders.STATUS[k]}</option>`).join("");
    const itemsTotal = o.itemsTotal != null ? o.itemsTotal : o.total;
    return `<div class="card card-pad mt-16">
      <div class="flex-between wrap">
        <div><strong>N° ${UI.esc(o.number)}</strong> <span class="status ${o.status}">${Orders.STATUS[o.status]}</span>
          ${o.paid ? `<span class="status livree">Encaissée</span>` : ""}
          <div class="text-muted" style="font-size:13px">${UI.dateFR(o.createdAt)} · ${UI.esc(o.buyerName)}</div></div>
        <select class="field" style="width:auto;padding:8px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--surface-2)" data-status data-order="${o.id}">${opts}</select>
      </div>
      ${o.status !== "annulee" ? deliveryStepper(o.status) : ""}
      <div class="divider" style="margin:12px 0"></div>
      ${o.items.map((it) => `<div class="cart-item" style="padding:8px 0;border:none">
        <img src="${UI.safeImg(it.image, it.title)}" style="width:50px;height:50px" alt=""/>
        <div class="cart-item-info"><h4>${UI.esc(it.title)}</h4><div class="ci-variant">Qté : ${it.qty} × ${UI.fcfa(it.unit)}</div></div>
        <strong>${UI.fcfa(it.unit * it.qty)}</strong></div>`).join("")}
      <div class="flex-between mt-8" style="font-size:13px"><span class="text-muted">Articles</span><span>${UI.fcfa(itemsTotal)}</span></div>
      ${o.discount ? `<div class="flex-between" style="font-size:13px;color:var(--accent)"><span>Remise ${o.couponCode ? "(" + UI.esc(o.couponCode) + ")" : ""}</span><span>− ${UI.fcfa(o.discount)}</span></div>` : ""}
      ${o.slot ? `<div class="flex-between" style="font-size:13px"><span class="text-muted">Créneau souhaité</span><span>${UI.esc(o.slot)}</span></div>` : ""}
      <div class="flex-between wrap" style="font-size:13px;gap:8px;align-items:center">
        <span class="text-muted">Frais de livraison (${UI.esc(o.delivery.commune)})</span>
        <span class="flex gap-8" style="align-items:center">
          <input type="number" min="0" class="stock-edit" data-fee-input="${o.id}" value="${o.deliveryFee || 0}" title="Frais de livraison" style="width:96px" />
          <span class="text-muted">FCFA</span>
          <button class="btn btn-ghost btn-sm" data-fee-save="${o.id}">Appliquer</button>
        </span>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      <div class="flex-between wrap" style="align-items:flex-start">
        <div style="font-size:13.5px"><strong>📍 Livraison :</strong> ${UI.esc(o.delivery.name)} · ${UI.esc(o.delivery.phone)}<br>
          ${UI.esc(o.delivery.commune)} — ${UI.esc(o.delivery.address)}${o.delivery.note ? `<br><em class="text-muted">Note : ${UI.esc(o.delivery.note)}</em>` : ""}</div>
        <div style="text-align:right"><div class="text-muted" style="font-size:12px">💵 À encaisser</div>
          <strong style="font-size:18px;color:var(--brand)">${UI.fcfa(o.total)}</strong></div>
      </div>
      <div class="flex gap-8 wrap mt-8">
        <button class="btn ${o.paid ? "btn-ghost" : "btn-accent"} btn-sm" data-paid="${o.id}">${o.paid ? "↩︎ Non encaissée" : "✓ Marquer encaissée"}</button>
        <button class="btn btn-ghost btn-sm" data-print="${o.id}">${SICON.printer} Bon de livraison</button>
        <button class="btn btn-ghost btn-sm" data-invoice="${o.id}">🧾 Reçu</button>
        <a class="btn wa-btn btn-sm" href="https://wa.me/225${UI.esc(o.delivery.phone.replace(/\D/g, ""))}" target="_blank" rel="noopener">${SICON.wa} Contacter</a>
        ${o.status !== "livree" && o.status !== "annulee" ? `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">Annuler</button>` : ""}
      </div>
      ${o.cancelReason ? `<div class="text-muted" style="font-size:12.5px;margin-top:6px"><em>Annulée : ${UI.esc(o.cancelReason)}</em></div>` : ""}
      ${o.return ? `<div class="seller-return-box return-${o.return.status}">
        <div><strong>↩️ Demande de ${UI.esc(o.return.type)}</strong> — ${UI.esc(o.return.reason)}${o.return.note ? `<div class="text-muted" style="font-size:12.5px">${UI.esc(o.return.note)}</div>` : ""}</div>
        ${o.return.status === "requested"
          ? `<div class="flex gap-8 mt-8"><button class="btn btn-accent btn-sm" data-return-accept="${o.id}">✅ Accepter</button><button class="btn btn-danger btn-sm" data-return-refuse="${o.id}">❌ Refuser</button></div>`
          : `<div class="text-muted" style="font-size:12.5px;margin-top:4px">${o.return.status === "accepted" ? "Acceptée ✅" : "Refusée ❌"}${o.return.resolution ? " — " + UI.esc(o.return.resolution) : ""}</div>`}
      </div>` : ""}
    </div>`;
  }

  /** Impression groupée de plusieurs bons de livraison. */
  function printMultipleSlips(orders) {
    if (!orders.length) { UI.toast("Aucune commande confirmée à imprimer.", "info"); return; }
    orders.forEach((o, i) => setTimeout(() => printDeliverySlip(o), i * 400));
    UI.toast(`${orders.length} bon(s) de livraison ouverts.`, "success");
  }

  /* ============================================================
     VENDEUR : Statistiques dédiées
     ============================================================ */
  function viewSellerStats(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const q = (params && params.query) || {};
    const period = ["7d", "30d", "month"].includes(q.p) ? q.p : "30d";
    const products = Products.byStore(store.id, true);
    const orders = Orders.byStore(store.id);

    const now = Date.now();
    const spans = { "7d": 7 * 86400000, "30d": 30 * 86400000, month: now - new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() };
    const span = spans[period];
    const min = now - span;
    const prevMin = min - span;
    const inRange = (o, a, b) => o.createdAt >= a && o.createdAt < b;
    const cur = orders.filter((o) => o.createdAt >= min);
    const prev = orders.filter((o) => inRange(o, prevMin, min));

    const sum = (arr) => arr.reduce((s, o) => s + (o.itemsTotal != null ? o.itemsTotal : o.total), 0);
    const caCur = sum(cur), caPrev = sum(prev);

    // Marge brute (ventes − coût d'achat) sur les commandes non annulées.
    const valid = cur.filter((o) => o.status !== "annulee");
    const grossMargin = valid.reduce((s, o) => s + o.items.reduce((a, it) => a + (it.unit - (it.cost || 0)) * it.qty, 0) - (o.discount || 0), 0);
    const expensesPeriod = Expenses.total(store.id, min);
    const netProfit = grossMargin - expensesPeriod;
    const avg = cur.length ? Math.round(caCur / cur.length) : 0;
    const delivered = cur.filter((o) => o.status === "livree").length;
    const cancelled = cur.filter((o) => o.status === "annulee").length;
    const collected = cur.filter((o) => o.paid).reduce((s, o) => s + o.total, 0);
    const toCollect = cur.filter((o) => !o.paid && o.status !== "annulee").reduce((s, o) => s + o.total, 0);
    const delivRate = cur.length ? Math.round((delivered / cur.length) * 100) : 0;
    const cancelRate = cur.length ? Math.round((cancelled / cur.length) * 100) : 0;

    // Évolution vs période précédente.
    const trend = (a, b) => {
      if (!b) return a ? { dir: "up", txt: "Nouveau" } : { dir: "flat", txt: "—" };
      const pct = Math.round(((a - b) / b) * 100);
      return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", txt: (pct > 0 ? "+" : "") + pct + "%" };
    };
    const caTrend = trend(caCur, caPrev);
    const ordTrend = trend(cur.length, prev.length);

    // Top produits (par ventes sur la période).
    const soldByProduct = {};
    const communeCount = {};
    cur.forEach((o) => {
      o.items.forEach((it) => { soldByProduct[it.title] = (soldByProduct[it.title] || 0) + it.qty; });
      communeCount[o.delivery.commune] = (communeCount[o.delivery.commune] || 0) + 1;
    });
    const topProducts = Object.entries(soldByProduct).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topCommunes = Object.entries(communeCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Conversion vues -> panier -> commandes (sur tout le catalogue).
    const totViews = products.reduce((s, p) => s + (p.views || 0), 0);
    const totCarts = products.reduce((s, p) => s + (p.cartAdds || 0), 0);
    const totSold = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);

    // Comparaison à la moyenne de la marketplace.
    const allOrders = DB.all(DB.KEYS.orders);
    const mpRate = allOrders.length ? Math.round((allOrders.filter((o) => o.status === "livree").length / allOrders.length) * 100) : 0;
    const myRateAll = orders.length ? Math.round((orders.filter((o) => o.status === "livree").length / orders.length) * 100) : 0;
    const storesCount = Store.all().length || 1;
    const mpAvgOrders = Math.round(allOrders.length / storesCount);

    // Insights favoris : nb d'acheteurs ayant mis chaque article en favori.
    const favMap = DB.get(DB.KEYS.favorites, {});
    const favCount = {};
    Object.values(favMap).forEach((ids) => (ids || []).forEach((id) => { favCount[id] = (favCount[id] || 0) + 1; }));
    const topFav = products.map((p) => ({ p, n: favCount[p.id] || 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);

    const pchip = (k, l) => `<a href="#/seller/stats?p=${k}" class="chip ${period === k ? "active" : ""}">${l}</a>`;
    const trendBadge = (t) => `<span style="font-size:12px;font-weight:800;color:${t.dir === "up" ? "var(--accent)" : t.dir === "down" ? "var(--danger)" : "var(--text-3)"}">${t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : ""} ${t.txt}</span>`;

    sellerLayout({
      active: "stats",
      title: "Statistiques",
      subtitle: "Analysez la performance de votre boutique.",
      actions: `<button class="btn btn-ghost" id="expCsv2">${SICON.download} Exporter commandes</button>`,
      body: `
        <div class="filter-bar" style="margin-bottom:18px">${pchip("7d", "7 jours")}${pchip("30d", "30 jours")}${pchip("month", "Ce mois")}</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-ico ic-green" style="font-size:20px">💰</div><div class="stat-val">${UI.fcfa(caCur)}</div><div class="stat-lbl">Ventes ${trendBadge(caTrend)}</div></div>
          <div class="stat-card"><div class="stat-ico ic-blue" style="font-size:20px">🧾</div><div class="stat-val">${cur.length}</div><div class="stat-lbl">Commandes ${trendBadge(ordTrend)}</div></div>
          <div class="stat-card"><div class="stat-ico ic-orange" style="font-size:20px">🛒</div><div class="stat-val">${UI.fcfa(avg)}</div><div class="stat-lbl">Panier moyen</div></div>
          <div class="stat-card"><div class="stat-ico ic-purple" style="font-size:20px">✅</div><div class="stat-val">${delivRate}%</div><div class="stat-lbl">Taux de livraison</div></div>
        </div>

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>Encaissement (COD)</h3></div>
            <div class="summary-row"><span>💵 Déjà encaissé</span><strong style="color:var(--accent)">${UI.fcfa(collected)}</strong></div>
            <div class="summary-row"><span>⏳ Reste à encaisser</span><strong style="color:var(--warning)">${UI.fcfa(toCollect)}</strong></div>
            <div class="summary-row"><span>❌ Taux d'annulation</span><span>${cancelRate}%</span></div>
            <div class="divider" style="margin:12px 0"></div>
            <div class="panel-head" style="margin:0 0 10px"><h3 style="font-size:15px">Entonnoir de conversion</h3></div>
            ${funnelRow("👁️ Vues", totViews, totViews)}
            ${funnelRow("🛒 Ajouts au panier", totCarts, totViews)}
            ${funnelRow("✅ Articles vendus", totSold, totViews)}
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>Top articles vendus</h3></div>
            ${topProducts.length ? topProducts.map(([t, n]) => `<div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span>${UI.esc(t)}</span><strong>${n}</strong></div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:12px 0">Aucune vente sur la période.</p>`}
            <div class="panel-head" style="margin:16px 0 10px"><h3 style="font-size:15px">Top communes clientes</h3></div>
            ${topCommunes.length ? topCommunes.map(([c, n]) => `<div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span>📍 ${UI.esc(c)}</span><strong>${n} cmd</strong></div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:12px 0">—</p>`}
          </div>
        </div>

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>Comparaison à la marketplace</h3></div>
            <div style="margin:6px 0"><div class="flex-between" style="font-size:13px"><span>Mon taux de livraison</span><strong style="color:${myRateAll >= mpRate ? "var(--accent)" : "var(--warning)"}">${myRateAll}%</strong></div>
              <div class="goal-bar" style="height:12px;margin-top:4px"><div class="goal-fill" style="width:${Math.max(3, myRateAll)}%"></div></div>
              <div class="text-muted" style="font-size:12px;margin-top:3px">Moyenne marketplace : ${mpRate}%</div></div>
            <div style="margin:14px 0 0"><div class="flex-between" style="font-size:13px"><span>Mes commandes reçues</span><strong>${orders.length}</strong></div>
              <div class="text-muted" style="font-size:12px;margin-top:3px">Moyenne par boutique : ${mpAvgOrders}</div></div>
            <div class="mt-16">${myRateAll >= mpRate ? `<span class="tag" style="position:static;background:var(--accent-soft);color:var(--accent)">✓ Au-dessus de la moyenne</span>` : `<span class="tag" style="position:static">À améliorer</span>`}</div>
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>❤️ Articles les plus aimés</h3></div>
            <p class="text-muted" style="font-size:12.5px;margin:0 0 8px">Demande latente : articles ajoutés en favoris par vos clients.</p>
            ${topFav.length ? topFav.map((x) => `<div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border)">
                <a href="#/product/${x.p.id}">${UI.esc(x.p.title)}</a><strong>${x.n} ❤️</strong></div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:12px 0">Aucun favori pour l'instant.</p>`}
          </div>
        </div>

        <div class="seller-cols mt-16">
          <div class="card card-pad">
            <div class="panel-head"><h3>💰 Bénéfice de la période</h3></div>
            <div class="summary-row"><span>Marge brute (ventes − coût d'achat)</span><strong>${UI.fcfa(grossMargin)}</strong></div>
            <div class="summary-row"><span>− Dépenses / charges</span><strong style="color:var(--danger)">${UI.fcfa(expensesPeriod)}</strong></div>
            <div class="summary-row total"><span>Bénéfice net</span><strong style="color:${netProfit >= 0 ? "var(--accent)" : "var(--danger)"}">${UI.fcfa(netProfit)}</strong></div>
            <p class="text-muted" style="font-size:12px;margin:8px 0 0">Renseignez le « coût d'achat » de vos articles pour affiner la marge.</p>
          </div>
          <div class="card card-pad">
            <div class="panel-head"><h3>🧾 Journal de caisse</h3><button class="btn btn-primary btn-sm" id="addExpense">+ Dépense</button></div>
            ${(() => { const list = Expenses.byStore(store.id).slice(0, 6); return list.length ? list.map((e) => `<div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border)">
                <div><strong style="font-size:13.5px">${UI.esc(e.label)}</strong><div class="text-muted" style="font-size:12px">${UI.esc(e.category)} · ${UI.timeAgo(e.createdAt)}</div></div>
                <div class="flex gap-8" style="align-items:center"><strong style="color:var(--danger)">− ${UI.fcfa(e.amount)}</strong><button class="icon-action danger" data-del-exp="${e.id}" title="Supprimer">${SICON.trash}</button></div></div>`).join("")
              : `<p class="text-muted" style="text-align:center;padding:14px 0">Aucune dépense enregistrée.</p>`; })()}
          </div>
        </div>

        <div class="card card-pad mt-16">
          <div class="panel-head"><h3>Outils & données</h3></div>
          <div class="flex gap-8 wrap">
            <button class="btn btn-ghost btn-sm" id="stPrint">${SICON.printer} Imprimer le rapport</button>
            <button class="btn btn-ghost btn-sm" id="stQr">${SICON.store} QR code boutique</button>
            <button class="btn btn-ghost btn-sm" id="stExpCat">${SICON.download} Exporter le catalogue (JSON)</button>
            <button class="btn btn-ghost btn-sm" id="stImpCat">${SICON.copy} Importer un catalogue</button>
            <button class="btn btn-ghost btn-sm" id="stBackup">${SICON.download} Sauvegarde complète</button>
            <button class="btn btn-ghost btn-sm" id="stRestore">↺ Restaurer une sauvegarde</button>
          </div>
        </div>`,
    });

    const w = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
    w("expCsv2", () => exportOrdersCSV(store, orders));
    w("stPrint", () => printStatsReport(store, { period, caCur, count: cur.length, avg, delivRate, cancelRate, collected, toCollect, topProducts, topCommunes, grossMargin, expensesPeriod, netProfit }));
    w("addExpense", () => openExpenseModal(() => viewSellerStats(params)));
    V().querySelectorAll("[data-del-exp]").forEach((b) => b.addEventListener("click", () => { Expenses.remove(b.getAttribute("data-del-exp")); viewSellerStats(params); }));
    w("stQr", () => showStoreQR(store));
    w("stExpCat", () => exportCatalog(store));
    w("stImpCat", openImportCatalog);
    w("stBackup", exportBackup);
    w("stRestore", openRestoreBackup);
  }

  function funnelRow(label, value, base) {
    const pct = base ? Math.round((value / base) * 100) : 0;
    return `<div style="margin:8px 0"><div class="flex-between" style="font-size:13px"><span>${label}</span><strong>${value}${base && value !== base ? ` · ${pct}%` : ""}</strong></div>
      <div class="goal-bar" style="height:12px;margin-top:4px"><div class="goal-fill" style="width:${Math.max(3, pct)}%;background:linear-gradient(90deg,var(--brand),var(--brand-dark))"></div></div></div>`;
  }

  /* ============================================================
     VENDEUR : Mes clients (mini-CRM)
     ============================================================ */
  function viewSellerClients() {
    if (!requireVendor()) return;
    const store = sellerStore();
    const orders = Orders.byStore(store.id);

    // Agrège les clients à partir des commandes.
    const map = {};
    orders.forEach((o) => {
      const key = o.buyerId || o.delivery.phone;
      if (!map[key]) map[key] = { name: o.buyerName, phone: o.delivery.phone, commune: o.delivery.commune, count: 0, total: 0, last: 0 };
      map[key].count++;
      map[key].total += o.total;
      map[key].last = Math.max(map[key].last, o.createdAt);
      map[key].phone = o.delivery.phone;
    });
    const INACTIVE_MS = 30 * 86400000;
    const segOf = (c) => c.last < Date.now() - INACTIVE_MS ? "inactif" : (c.count >= 3 ? "fidele" : "nouveau");
    const clients = Object.values(map).map((c) => Object.assign(c, { seg: segOf(c) })).sort((a, b) => b.total - a.total);
    const totalRevenue = clients.reduce((s, c) => s + c.total, 0);
    const counts = { nouveau: 0, fidele: 0, inactif: 0 };
    clients.forEach((c) => counts[c.seg]++);
    const segLabel = { nouveau: "Nouveau", fidele: "Fidèle", inactif: "Inactif" };
    const winbackText = (c) => encodeURIComponent(`Bonjour ${c.name || ""}, cela fait un moment ! Découvrez nos nouveautés chez ${store.name}. À bientôt 🙂`);

    sellerLayout({
      active: "clients",
      title: "Mes clients",
      subtitle: `${clients.length} client(s) · ${UI.fcfa(totalRevenue)} de commandes`,
      actions: "",
      body: clients.length ? `
        <div class="filter-bar" style="margin-bottom:16px">
          <span class="chip">👥 ${clients.length} total</span>
          <span class="chip">🆕 ${counts.nouveau} nouveaux</span>
          <span class="chip">⭐ ${counts.fidele} fidèles</span>
          <span class="chip">😴 ${counts.inactif} inactifs</span>
        </div>
        ${counts.inactif ? `<div class="cod-note" style="margin-bottom:14px"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg><span><strong>${counts.inactif} client(s) inactif(s)</strong> (+30 j) — relancez-les via WhatsApp pour les faire revenir.</span></div>` : ""}
        <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Client</th><th>Segment</th><th>Commune</th><th>Commandes</th><th>Total</th><th>Dernière</th><th></th></tr></thead>
        <tbody>${clients.map((c) => `<tr>
          <td><div class="flex gap-8" style="align-items:center"><div class="review-avatar">${UI.esc((c.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
            <div><strong>${UI.esc(c.name)}</strong><div class="text-muted" style="font-size:12px">${UI.esc(c.phone)}</div></div></div></td>
          <td><span class="seg-badge seg-${c.seg}">${segLabel[c.seg]}</span></td>
          <td>${UI.esc(c.commune)}</td>
          <td>${c.count}</td>
          <td style="font-weight:700;color:var(--brand)">${UI.fcfa(c.total)}</td>
          <td>${UI.timeAgo(c.last)}</td>
          <td><a class="btn wa-btn btn-sm" href="https://wa.me/225${UI.esc(String(c.phone).replace(/\D/g, ""))}${c.seg === "inactif" ? "?text=" + winbackText(c) : ""}" target="_blank" rel="noopener">${SICON.wa} ${c.seg === "inactif" ? "Relancer" : "Contacter"}</a></td>
        </tr>`).join("")}</tbody></table></div>`
        : emptyState("👥", "Aucun client", "Vos clients apparaîtront ici après leur première commande."),
    });
  }

  /* ============================================================
     VENDEUR : Codes promo (coupons)
     ============================================================ */
  function viewSellerCoupons() {
    if (!requireVendor()) return;
    const store = sellerStore();
    const list = Coupons.byStore(store.id);

    sellerLayout({
      active: "promos",
      title: "Codes promo",
      subtitle: `${list.length} code(s) · livraison offerte dès ${store.freeShipThreshold ? UI.fcfa(store.freeShipThreshold) : "— (désactivé)"}`,
      actions: `<button class="btn btn-primary" id="newCoupon">+ Nouveau code</button>`,
      body: list.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Avantage</th><th>Min. achat</th><th>Utilisations</th><th>Expire</th><th>État</th><th></th></tr></thead>
        <tbody>${list.map((c) => `<tr>
          <td><strong style="letter-spacing:.5px">${UI.esc(c.code)}</strong></td>
          <td><span class="tag promo" style="position:static">${Coupons.label(c)}</span></td>
          <td>${c.minTotal ? UI.fcfa(c.minTotal) : "—"}</td>
          <td>${c.uses}${c.maxUses ? " / " + c.maxUses : ""}</td>
          <td>${c.until ? UI.dateFR(c.until) : "—"}</td>
          <td><span class="status ${c.active ? "published" : "draft"}">${c.active ? "Actif" : "Inactif"}</span></td>
          <td><div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-toggle-c="${c.id}">${c.active ? "Désactiver" : "Activer"}</button>
            <button class="icon-action danger" data-del-c="${c.id}" title="Supprimer">${SICON.trash}</button>
          </div></td>
        </tr>`).join("")}</tbody></table></div>`
        : emptyState("🏷️", "Aucun code promo", "Créez un code (remise en %, en FCFA, ou livraison offerte) que vos clients saisiront au paiement.", `<button class="btn btn-primary" id="newCoupon2">+ Nouveau code</button>`),
    });

    const openForm = () => openCouponModal(() => viewSellerCoupons());
    ["newCoupon", "newCoupon2"].forEach((id) => { const b = document.getElementById(id); if (b) b.addEventListener("click", openForm); });
    V().querySelectorAll("[data-toggle-c]").forEach((b) => b.addEventListener("click", () => {
      const c = Coupons.all().find((x) => x.id === b.getAttribute("data-toggle-c"));
      Coupons.update(c.id, { active: !c.active }); viewSellerCoupons();
    }));
    V().querySelectorAll("[data-del-c]").forEach((b) => b.addEventListener("click", async () => {
      if (await UI.confirm("Supprimer ce code promo ?", { danger: true, confirmLabel: "Supprimer" })) { Coupons.remove(b.getAttribute("data-del-c")); UI.toast("Code supprimé.", "info"); viewSellerCoupons(); }
    }));
  }

  function openCouponModal(after) {
    UI.modal({
      title: "Nouveau code promo",
      body: `<div class="form-grid">
        <div class="field"><label>Code *</label><input id="cCode" placeholder="Ex : BIENVENUE10" style="text-transform:uppercase" /></div>
        <div class="field"><label>Type d'avantage</label><select id="cType">
          <option value="percent">Remise en %</option>
          <option value="amount">Remise en FCFA</option>
          <option value="freeship">Livraison offerte</option>
        </select></div>
        <div class="field" id="cValueWrap"><label>Valeur</label><input type="number" id="cValue" min="1" placeholder="Ex : 10" /></div>
        <div class="form-grid form-2col">
          <div class="field"><label>Achat minimum (FCFA)</label><input type="number" id="cMin" min="0" placeholder="0" /></div>
          <div class="field"><label>Limite d'utilisations</label><input type="number" id="cMax" min="0" placeholder="0 = illimité" /></div>
        </div>
        <div class="field"><label>Date d'expiration (optionnel)</label><input type="date" id="cUntil" /></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="cGo">Créer le code</button>`,
      onMount(m, close) {
        const typeSel = m.querySelector("#cType");
        const valWrap = m.querySelector("#cValueWrap");
        typeSel.addEventListener("change", () => { valWrap.style.display = typeSel.value === "freeship" ? "none" : "flex"; });
        m.querySelector("#cGo").addEventListener("click", () => {
          const res = Coupons.create({
            code: m.querySelector("#cCode").value,
            type: typeSel.value,
            value: m.querySelector("#cValue").value,
            minTotal: m.querySelector("#cMin").value,
            maxUses: m.querySelector("#cMax").value,
            until: m.querySelector("#cUntil").value ? new Date(m.querySelector("#cUntil").value).getTime() : 0,
          });
          if (res.ok) { UI.toast("Code promo créé ✓", "success"); close(); if (after) after(); }
          else UI.toast(res.error, "error");
        });
      },
    });
  }

  function openExpenseModal(after) {
    UI.modal({
      title: "Nouvelle dépense",
      body: `<div class="form-grid">
        <div class="field"><label>Libellé *</label><input id="eLabel" placeholder="Ex : Achat de tissu" /></div>
        <div class="form-grid form-2col">
          <div class="field"><label>Montant (FCFA) *</label><input type="number" id="eAmount" min="1" placeholder="Ex : 25000" /></div>
          <div class="field"><label>Catégorie</label><select id="eCat">${Expenses.CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="eGo">Enregistrer</button>`,
      onMount(m, close) {
        m.querySelector("#eGo").addEventListener("click", () => {
          const res = Expenses.add({ label: m.querySelector("#eLabel").value, amount: m.querySelector("#eAmount").value, category: m.querySelector("#eCat").value });
          if (res.ok) { UI.toast("Dépense enregistrée ✓", "success"); close(); if (after) after(); }
          else UI.toast(res.error, "error");
        });
      },
    });
  }

  /* ============================================================
     MESSAGERIE : conversation réutilisable (vendeur / acheteur)
     ============================================================ */
  function conversationHTML(msgs) {
    if (!msgs.length) return `<p class="text-muted" style="text-align:center;padding:24px 0">Aucun message. Démarrez la conversation ci-dessous.</p>`;
    return msgs.map((m) => `<div class="msg-bubble ${m.from}">
      <div class="msg-text">${UI.esc(m.text)}</div>
      <div class="msg-time">${UI.timeAgo(m.createdAt)}</div>
    </div>`).join("");
  }

  /** Vendeur : boîte de réception + conversations. */
  function viewSellerMessages(params) {
    if (!requireVendor()) return;
    const store = sellerStore();
    const threads = Messages.threadsForStore(store.id);
    const activeBuyer = params && params.query && params.query.b;

    if (activeBuyer) {
      Messages.markRead(store.id, activeBuyer, "seller");
      const msgs = Messages.conversation(store.id, activeBuyer);
      const buyerName = (msgs[0] && msgs[0].buyerName) || "Client";
      sellerLayout({
        active: "messages",
        title: "Conversation",
        subtitle: buyerName,
        actions: `<a href="#/seller/messages" class="btn btn-ghost">← Toutes les conversations</a>`,
        body: `<div class="card card-pad"><div class="msg-thread">${conversationHTML(msgs)}</div>
          <div class="quick-replies mt-16">${QUICK_REPLIES.map((q) => `<button type="button" class="chip" data-qr="${UI.esc(q)}">${UI.esc(q)}</button>`).join("")}</div>
          <form id="msgForm" class="flex gap-8"><input id="msgText" placeholder="Écrire une réponse…" style="flex:1;padding:11px 14px;border-radius:var(--r-full);border:1.5px solid var(--border);background:var(--surface-2);color:var(--text)" />
          <button class="btn btn-primary" type="submit">Envoyer</button></form></div>`,
      });
      V().querySelectorAll("[data-qr]").forEach((b) => b.addEventListener("click", () => {
        const inp = document.getElementById("msgText"); inp.value = b.getAttribute("data-qr"); inp.focus();
      }));
      const form = document.getElementById("msgForm");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const t = document.getElementById("msgText").value;
        if (!t.trim()) return;
        Messages.send({ storeId: store.id, buyerId: activeBuyer, buyerName, from: "seller", text: t });
        viewSellerMessages(params);
      });
      const thread = V().querySelector(".msg-thread"); if (thread) thread.scrollTop = thread.scrollHeight;
      return;
    }

    sellerLayout({
      active: "messages",
      title: "Messages",
      subtitle: `${threads.length} conversation(s)`,
      actions: "",
      body: threads.length ? `<div class="card" style="overflow:hidden">${threads.map((t) => `
        <a href="#/seller/messages?b=${encodeURIComponent(t.buyerId)}" class="thread-row">
          <div class="review-avatar">${UI.esc((t.buyerName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
          <div style="flex:1"><strong>${UI.esc(t.buyerName || "Client")}</strong><div class="text-muted" style="font-size:12px">${t.count} message(s) · ${UI.timeAgo(t.last)}</div></div>
          ${t.unread ? `<span class="ss-badge" style="position:static">${t.unread}</span>` : ""}
        </a>`).join("")}</div>`
        : emptyState("💬", "Aucun message", "Les questions de vos clients apparaîtront ici."),
    });
  }

  /** Acheteur : ses conversations avec les boutiques. */
  function viewBuyerMessages(params) {
    if (!requireAuth()) return;
    const user = Auth.current();
    const activeStore = params && params.query && params.query.s;

    if (activeStore) {
      const store = Store.get(activeStore);
      if (!store) { Router.go("#/messages"); return; }
      Messages.markRead(store.id, user.id, "buyer");
      const msgs = Messages.conversation(store.id, user.id);
      layout(`<nav class="breadcrumb"><a href="#/messages">Messages</a> › <span>${UI.esc(store.name)}</span></nav>
        <div class="page-head"><div><div class="page-title">${UI.esc(store.name)}</div><div class="page-sub"><a href="#/store/${store.id}">Voir la boutique</a></div></div></div>
        <div class="card card-pad"><div class="msg-thread">${conversationHTML(msgs)}</div>
        <form id="bmsgForm" class="flex gap-8 mt-16"><input id="bmsgText" placeholder="Écrire un message…" style="flex:1;padding:11px 14px;border-radius:var(--r-full);border:1.5px solid var(--border);background:var(--surface-2);color:var(--text)" />
        <button class="btn btn-primary" type="submit">Envoyer</button></form></div>`);
      const form = document.getElementById("bmsgForm");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const t = document.getElementById("bmsgText").value;
        if (!t.trim()) return;
        Messages.send({ storeId: store.id, buyerId: user.id, buyerName: user.name, from: "buyer", text: t });
        viewBuyerMessages(params);
      });
      const thread = V().querySelector(".msg-thread"); if (thread) thread.scrollTop = thread.scrollHeight;
      return;
    }

    const threads = Messages.threadsForBuyer(user.id);
    layout(`<div class="page-head"><div><div class="page-title">Mes messages</div><div class="page-sub">${threads.length} conversation(s)</div></div></div>
      ${threads.length ? `<div class="card" style="overflow:hidden">${threads.map((t) => { const st = Store.get(t.storeId); if (!st) return ""; return `
        <a href="#/messages?s=${encodeURIComponent(t.storeId)}" class="thread-row">
          <img src="${UI.safeImg(st.logo, st.name)}" alt="" style="width:40px;height:40px;border-radius:10px;object-fit:cover" />
          <div style="flex:1"><strong>${UI.esc(st.name)}</strong><div class="text-muted" style="font-size:12px">${t.count} message(s) · ${UI.timeAgo(t.last)}</div></div>
          ${t.unread ? `<span class="ss-badge" style="position:static">${t.unread}</span>` : ""}
        </a>`; }).join("")}</div>`
        : emptyState("💬", "Aucun message", "Posez une question à une boutique depuis une fiche article.", `<a href="#/" class="btn btn-primary">Explorer</a>`)}`);
  }

  /* ============================================================
     ADMIN : Console de modération
     ============================================================ */
  function viewAdmin() {
    if (!requireAuth()) return;
    if (!Auth.isAdmin()) { UI.toast("Accès réservé à l'administrateur.", "error"); Router.go("#/"); return; }
    const stores = Store.all();
    const products = Products.all();
    const orders = DB.all(DB.KEYS.orders);
    const users = DB.all(DB.KEYS.users);
    const revenue = orders.reduce((s, o) => s + o.total, 0);

    layout(`
      <div class="page-head"><div><div class="page-title">Administration</div>
        <div class="page-sub">Vue d'ensemble de la marketplace</div></div>
        <button class="btn btn-ghost" id="reseedBtn">Réinitialiser les données démo</button></div>
      <div class="stat-grid">
        ${statCard("ic-orange", "🏪", stores.length, "Boutiques")}
        ${statCard("ic-blue", "📦", products.length, "Articles")}
        ${statCard("ic-purple", "👤", users.length, "Utilisateurs")}
        ${statCard("ic-green", "💰", UI.fcfa(revenue), "Volume commandé")}
      </div>

      <div class="section-title">Boutiques</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Boutique</th><th>Commune</th><th>Articles</th><th>Commandes</th><th></th></tr></thead>
        <tbody>${stores.map((s) => `<tr>
          <td><div class="flex gap-8" style="align-items:center"><img src="${UI.safeImg(s.logo, s.name)}" style="width:36px;height:36px;border-radius:8px" alt=""/>
            <a href="#/store/${s.id}" style="font-weight:600">${UI.esc(s.name)}</a></div></td>
          <td>${UI.esc(s.commune)}</td>
          <td>${Products.byStore(s.id, true).length}</td>
          <td>${Orders.byStore(s.id).length}</td>
          <td><button class="btn btn-danger btn-sm" data-delstore="${s.id}">Supprimer</button></td>
        </tr>`).join("")}</tbody>
      </table></div>

      <div class="section-title">Derniers articles</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Article</th><th>Boutique</th><th>Prix</th><th>Statut</th><th></th></tr></thead>
        <tbody>${products.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 12).map((p) => {
          const st = Store.get(p.storeId);
          return `<tr><td><a href="#/product/${p.id}" style="font-weight:600">${UI.esc(p.title)}</a></td>
            <td>${UI.esc(st ? st.name : "—")}</td><td>${UI.fcfa(Products.effectivePrice(p))}</td>
            <td><span class="status ${p.status}">${statusLabel(p.status)}</span></td>
            <td><button class="btn btn-danger btn-sm" data-delprod="${p.id}">Retirer</button></td></tr>`;
        }).join("")}</tbody>
      </table></div>`);

    V().querySelectorAll("[data-delstore]").forEach((b) => b.addEventListener("click", async () => {
      if (await UI.confirm("Supprimer cette boutique et tous ses articles ?", { danger: true, confirmLabel: "Supprimer" })) {
        Store.remove(b.getAttribute("data-delstore")); UI.toast("Boutique supprimée.", "info"); viewAdmin();
      }
    }));
    V().querySelectorAll("[data-delprod]").forEach((b) => b.addEventListener("click", async () => {
      if (await UI.confirm("Retirer cet article ?", { danger: true, confirmLabel: "Retirer" })) {
        Products.remove(b.getAttribute("data-delprod")); UI.toast("Article retiré.", "info"); viewAdmin();
      }
    }));
    document.getElementById("reseedBtn").addEventListener("click", async () => {
      if (await UI.confirm("Réinitialiser TOUTES les données de démonstration ? Cette action est irréversible.", { danger: true, confirmLabel: "Réinitialiser" })) {
        Seed.run(true); Auth.logout(); renderHeaderUser(); UI.refreshBadges(); UI.toast("Données réinitialisées.", "success"); Router.go("#/");
      }
    });
  }

  /* ============================================================
     Uploader d'images (base64) — HTML + wiring
     ============================================================ */
  function uploaderHTML(id, initial, multiple) {
    return `<div class="uploader" id="${id}_zone" role="button" tabindex="0">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13v5H5v-5H3v7h18v-7zM11 4.8 7.6 8.2 6.2 6.8 12 1l5.8 5.8-1.4 1.4L13 4.8V16h-2z"/></svg>
        <div class="text-muted" style="font-size:13px">Cliquez pour ${multiple ? "ajouter des images" : "choisir une image"}</div>
      </div>
      <input type="file" id="${id}_input" accept="image/*" ${multiple ? "multiple" : ""} hidden />
      <div class="upl-previews" id="${id}_prev"></div>`;
  }

  // Budgets de compression par type d'image (préserve le quota localStorage).
  const IMG_BUDGETS = {
    logoUp: { maxSize: 400, maxBytes: 45 * 1024 },
    bannerUp: { maxSize: 1280, maxBytes: 150 * 1024 },
    galUp: { maxSize: 1000, maxBytes: 85 * 1024 },
    prodImgs: { maxSize: 1100, maxBytes: 120 * 1024 },
  };

  function wireUploader(id, initial, multiple) {
    let images = (initial || []).slice();
    const budget = IMG_BUDGETS[id] || { maxSize: 1000, maxBytes: 100 * 1024 };
    const zone = document.getElementById(id + "_zone");
    const input = document.getElementById(id + "_input");
    const prev = document.getElementById(id + "_prev");

    function render() {
      prev.innerHTML = images.map((im, i) => `<div class="upl-thumb"><img src="${UI.safeImg(im, "img")}" alt=""/><button type="button" class="upl-del" data-i="${i}">×</button></div>`).join("");
      prev.querySelectorAll(".upl-del").forEach((b) => b.addEventListener("click", () => { images.splice(Number(b.getAttribute("data-i")), 1); render(); }));
    }
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (files.length) UI.toast("Optimisation de l'image…", "info");
      for (const f of files) {
        try {
          const url = await UI.fileToDataURL(f, budget);
          if (multiple) images.push(url); else images = [url];
        } catch (e) { UI.toast("Image invalide ignorée.", "error"); }
      }
      input.value = "";
      render();
    });
    render();
    return { get: () => images.slice() };
  }

  /* ============================================================
     En-tête : menu utilisateur, thème, boutons
     ============================================================ */
  function renderHeaderUser() {
    const user = Auth.current();
    const initials = user ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
    const av = document.getElementById("avatarInitials");
    const btn = document.getElementById("avatarBtn");
    if (user && user.avatar) { btn.style.backgroundImage = `url("${UI.safeImg(user.avatar, user.name)}")`; btn.style.backgroundSize = "cover"; av.textContent = ""; }
    else { btn.style.backgroundImage = ""; av.textContent = user ? initials : "👤"; }

    const dd = document.getElementById("userDropdown");
    if (!user) {
      dd.innerHTML = `
        <a href="#/login" class="dd-item">🔑 ${T("menu.login")}</a>
        <a href="#/login?mode=register" class="dd-item">📝 ${T("menu.register")}</a>
        <div class="divider" style="margin:6px 0"></div>
        <a href="#/login?mode=register" class="dd-item">🏪 ${T("menu.becomeSeller")}</a>`;
    } else {
      const store = Store.byOwner(user.id);
      dd.innerHTML = `
        <div class="dd-head"><div class="dd-name">${UI.esc(user.name)}</div><div class="dd-mail">${UI.esc(user.email)}</div>
          <span class="dd-role">${user.role === "admin" ? "Admin" : user.role === "vendor" ? "Vendeur" : "Client"}</span></div>
        <a href="#/profile" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/></svg>${T("menu.profile")}</a>
        <a href="#/orders" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4V2h10v2h4v2h-2v14H5V6H3V4z"/></svg>${T("menu.orders")}</a>
        <a href="#/favorites" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-6.7-4.35-9.33-8.36C.9 9.7 2.1 6 5.4 6a4.3 4.3 0 0 1 3.6 2 4.3 4.3 0 0 1 3.6-2c3.3 0 4.5 3.7 2.73 6.64C18.7 16.65 12 21 12 21z"/></svg>${T("menu.favorites")}</a>
        <a href="#/messages" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>${T("menu.messages")}${Messages.unreadForBuyer(user.id) ? ` <span class="ss-badge" style="position:static;margin-left:auto">${Messages.unreadForBuyer(user.id)}</span>` : ""}</a>
        ${store
          ? `<a href="#/seller/dashboard" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10 3h8v5h-8z"/></svg>${T("menu.sellerSpace")}</a>`
          : `<a href="#/seller/store" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16l1 5-2 1v10H5V10L3 9zm3 8v6h4v-4h2v4h4v-6z"/></svg>${T("menu.openShop")}</a>`}
        ${user.role === "admin" ? `<a href="#/admin" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z"/></svg>${T("menu.admin")}</a>` : ""}
        <div class="divider" style="margin:6px 0"></div>
        <button class="dd-item danger" id="ddLogout"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>${T("menu.logout")}</button>`;
      const lo = document.getElementById("ddLogout");
      if (lo) lo.addEventListener("click", () => { Auth.logout(); renderHeaderUser(); UI.refreshBadges(); UI.toast("Déconnecté.", "info"); Router.go("#/"); });
    }
    // Ferme le menu après clic sur un lien.
    dd.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => (dd.hidden = true)));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    DB.set(DB.KEYS.theme, theme);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#0e1117" : "#f97316");
  }

  function wireHeader() {
    // Recherche + autocomplétion + vocal.
    const input = document.getElementById("headerSearchInput");
    const suggest = document.getElementById("searchSuggest");
    document.getElementById("headerSearchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      SearchHist.add(v);
      suggest.hidden = true;
      Router.go("#/search?q=" + encodeURIComponent(v));
    });

    function renderSuggest() {
      const q = input.value.trim().toLowerCase();
      let html = "";
      if (!q) {
        const hist = SearchHist.list();
        const popular = ["pagne", "smartphone", "attiéké", "sac", "écouteurs"];
        if (hist.length) html += `<div class="sg-head">Récentes <button type="button" id="sgClear">effacer</button></div>` + hist.slice(0, 6).map((t) => `<button type="button" class="sg-item" data-term="${UI.esc(t)}">🕘 ${UI.esc(t)}</button>`).join("");
        html += `<div class="sg-head">Populaires</div>` + popular.map((t) => `<button type="button" class="sg-item" data-term="${t}">🔥 ${t}</button>`).join("");
      } else {
        const res = Products.search({ q }).slice(0, 6);
        const stores = Store.all().filter((s) => s.name.toLowerCase().includes(q)).slice(0, 3);
        html += res.map((p) => `<button type="button" class="sg-item" data-go="#/product/${p.id}"><img src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/>${UI.esc(p.title)} <span class="sg-price">${UI.fcfa(Products.effectivePrice(p))}</span></button>`).join("");
        html += stores.map((s) => `<button type="button" class="sg-item" data-go="#/store/${s.id}">🏪 ${UI.esc(s.name)}</button>`).join("");
        if (!res.length && !stores.length) html = `<div class="sg-head">Aucune suggestion — appuyez sur Entrée</div>`;
      }
      suggest.innerHTML = html;
      suggest.hidden = false;
      suggest.querySelectorAll("[data-term]").forEach((b) => b.addEventListener("click", () => { input.value = b.getAttribute("data-term"); SearchHist.add(input.value); suggest.hidden = true; Router.go("#/search?q=" + encodeURIComponent(input.value)); }));
      suggest.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { suggest.hidden = true; input.value = ""; Router.go(b.getAttribute("data-go")); }));
      const clr = document.getElementById("sgClear");
      if (clr) clr.addEventListener("click", (e) => { e.stopPropagation(); SearchHist.clear(); renderSuggest(); });
    }
    input.addEventListener("focus", renderSuggest);
    input.addEventListener("input", renderSuggest);
    document.addEventListener("click", (e) => { if (!document.getElementById("headerSearchForm").contains(e.target)) suggest.hidden = true; });

    // Recherche vocale (Web Speech API — 100 % navigateur).
    const micBtn = document.getElementById("micBtn");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = "none"; }
    else micBtn.addEventListener("click", () => {
      const rec = new SR();
      rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1;
      micBtn.classList.add("listening");
      rec.onresult = (ev) => { const t = ev.results[0][0].transcript; input.value = t; SearchHist.add(t); Router.go("#/search?q=" + encodeURIComponent(t)); };
      rec.onerror = () => UI.toast("Recherche vocale indisponible.", "info");
      rec.onend = () => micBtn.classList.remove("listening");
      try { rec.start(); } catch (e) { micBtn.classList.remove("listening"); }
    });
    // Thème.
    document.getElementById("themeToggle").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "dark" ? "light" : "dark");
    });
    // Boutons d'en-tête.
    document.getElementById("navCart").addEventListener("click", () => Router.go("#/cart"));
    document.getElementById("navNotif").addEventListener("click", () => Router.go("#/notifications"));
    document.getElementById("navFavorites").addEventListener("click", () => Router.go("#/favorites"));
    // Menu utilisateur.
    const dd = document.getElementById("userDropdown");
    document.getElementById("avatarBtn").addEventListener("click", (e) => { e.stopPropagation(); dd.hidden = !dd.hidden; });
    document.addEventListener("click", (e) => { if (!document.getElementById("userMenu").contains(e.target)) dd.hidden = true; });
  }

  /* ============================================================
     Assistant virtuel (chatbot d'aide — règles simples)
     ============================================================ */
  const BOT_INTENTS = [
    { keys: ["paiement", "payer", "espèce", "cash", "carte", "mobile money"], answer: "💵 Le paiement se fait uniquement <strong>à la livraison, en espèces</strong>. Aucun paiement en ligne n'est requis." },
    { keys: ["livraison", "livrer", "délai", "frais", "combien de temps"], answer: "🚚 Chaque vendeur fixe ses frais et délais de livraison selon votre commune. Le montant s'affiche sur la fiche article et au panier." },
    { keys: ["commander", "acheter", "commande", "panier"], answer: "🛒 Ajoutez des articles au panier, puis validez en renseignant votre adresse. Vous payez à la réception !", link: "#/cart", linkLabel: "Voir mon panier" },
    { keys: ["vendeur", "vendre", "boutique", "ouvrir"], answer: "🏪 Créez votre compte puis ouvrez votre boutique en quelques minutes.", link: "#/seller/store", linkLabel: "Ouvrir ma boutique" },
    { keys: ["annuler", "annulation", "rembours"], answer: "❌ Vous pouvez annuler une commande tant qu'elle n'est pas livrée, depuis « Mes commandes ».", link: "#/orders", linkLabel: "Mes commandes" },
    { keys: ["promo", "réduction", "code", "coupon", "bon plan"], answer: "🔥 Retrouvez toutes les promotions dans « Bons plans ». Les codes promo se saisissent au paiement.", link: "#/deals", linkLabel: "Voir les bons plans" },
    { keys: ["fidélité", "point", "cagnotte", "parrain"], answer: "💛 Gagnez des points à chaque commande et grimpez les paliers (Bronze, Argent, Or). Parrainez vos proches avec votre code depuis votre profil.", link: "#/profile", linkLabel: "Mon profil" },
    { keys: ["suivi", "suivre", "où est", "statut"], answer: "📦 Suivez l'avancement de vos commandes (reçue → confirmée → expédiée → livrée) dans « Mes commandes ».", link: "#/orders", linkLabel: "Mes commandes" },
    { keys: ["contact", "vendeur", "question", "message"], answer: "💬 Depuis une fiche article, cliquez sur « Poser une question au vendeur » ou utilisez la messagerie." },
    { keys: ["bonjour", "salut", "coucou", "bonsoir"], answer: "👋 Bonjour ! Je suis l'assistant Marché CI. Posez-moi une question ou choisissez un sujet ci-dessous." },
    { keys: ["merci", "super", "génial", "ok"], answer: "😊 Avec plaisir ! N'hésitez pas si vous avez d'autres questions." },
  ];
  const BOT_SUGGESTIONS = ["Comment payer ?", "Frais de livraison ?", "Comment commander ?", "Devenir vendeur", "Mes points fidélité"];

  function botReply(text) {
    const t = (text || "").toLowerCase();
    const hit = BOT_INTENTS.find((it) => it.keys.some((k) => t.includes(k)));
    if (hit) return hit;
    return { answer: "🤔 Je n'ai pas bien compris. Voici les sujets que je maîtrise :", suggestions: true };
  }

  function mountChatbot() {
    if (document.getElementById("chatbotRoot")) return;
    const root = document.createElement("div");
    root.id = "chatbotRoot";
    root.innerHTML = `
      <button class="chatbot-fab" id="chatbotFab" aria-label="Assistant d'aide">💬</button>
      <div class="chatbot-panel" id="chatbotPanel" hidden>
        <div class="chatbot-head"><span>🤖 Assistant Marché CI</span><button id="chatbotClose" aria-label="Fermer">✕</button></div>
        <div class="chatbot-body" id="chatbotBody"></div>
        <form class="chatbot-input" id="chatbotForm">
          <input type="text" id="chatbotText" placeholder="Écrivez votre question…" autocomplete="off" />
          <button type="submit" aria-label="Envoyer">➤</button>
        </form>
      </div>`;
    document.body.appendChild(root);

    const panel = root.querySelector("#chatbotPanel");
    const body = root.querySelector("#chatbotBody");
    const addMsg = (html, who) => { const d = document.createElement("div"); d.className = "chat-msg " + who; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; };
    const addSuggestions = () => {
      const wrap = document.createElement("div"); wrap.className = "chat-suggestions";
      BOT_SUGGESTIONS.forEach((s) => { const b = document.createElement("button"); b.className = "chat-chip"; b.textContent = s; b.addEventListener("click", () => handle(s)); wrap.appendChild(b); });
      body.appendChild(wrap); body.scrollTop = body.scrollHeight;
    };
    const handle = (text) => {
      addMsg(UI.esc(text), "user");
      const r = botReply(text);
      setTimeout(() => {
        let html = r.answer;
        if (r.link) html += `<div style="margin-top:8px"><a href="${r.link}" class="chat-link" data-chatlink="${r.link}">${r.linkLabel || "Ouvrir"} →</a></div>`;
        addMsg(html, "bot");
        if (r.suggestions) addSuggestions();
        const cl = body.querySelector("[data-chatlink]:last-of-type");
        body.querySelectorAll("[data-chatlink]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); Router.go(a.getAttribute("data-chatlink")); panel.hidden = true; }));
      }, 260);
    };

    let greeted = false;
    root.querySelector("#chatbotFab").addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden && !greeted) { greeted = true; addMsg("👋 Bonjour ! Je suis l'assistant Marché CI. Comment puis-je vous aider ?", "bot"); addSuggestions(); }
    });
    root.querySelector("#chatbotClose").addEventListener("click", () => { panel.hidden = true; });
    root.querySelector("#chatbotForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = root.querySelector("#chatbotText");
      const v = inp.value.trim(); if (!v) return;
      inp.value = ""; handle(v);
    });
  }

  /* ============================================================
     Délégation globale : navigation [data-href] et favoris [data-fav]
     ============================================================ */
  function wireGlobalDelegation() {
    document.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.preventDefault(); e.stopPropagation();
        const id = fav.getAttribute("data-fav");
        const added = Fav.toggle(id);
        if (added === null) return;
        fav.classList.toggle("active", added);
        UI.toast(added ? "Ajouté aux favoris ❤️" : "Retiré des favoris", added ? "success" : "info");
        return;
      }
      const nav = e.target.closest("[data-href]");
      if (nav && !e.target.closest("a")) {
        Router.go(nav.getAttribute("data-href"));
      }
    });
    // Accessibilité clavier : Entrée/Espace activent les éléments [data-href] (cartes produit…).
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const nav = e.target.closest && e.target.closest("[data-href]");
      if (nav && e.target === nav) { e.preventDefault(); Router.go(nav.getAttribute("data-href")); }
    });
  }

  /* ============================================================
     Enregistrement des routes
     ============================================================ */
  function registerRoutes() {
    Router.on("#/", viewHome);
    Router.on("#/search", viewSearch);
    Router.on("#/deals", viewDeals);
    Router.on("#/compare", viewCompare);
    Router.on("#/stores", viewStores);
    Router.on("#/category/:id", viewCategory);
    Router.on("#/activity", viewActivity);
    Router.on("#/help", viewHelp);
    Router.on("#/product/:id", viewProduct);
    Router.on("#/store/:id", viewStore);
    Router.on("#/cart", viewCart);
    Router.on("#/checkout", viewCheckout);
    Router.on("#/order/:id", viewOrderConfirm);
    Router.on("#/orders", viewOrders);
    Router.on("#/favorites", viewFavorites);
    Router.on("#/notifications", viewNotifications);
    Router.on("#/login", viewLogin);
    Router.on("#/profile", viewProfile);
    Router.on("#/seller/store", viewStoreForm);
    Router.on("#/seller/dashboard", viewSellerDashboard);
    Router.on("#/seller/products", viewSellerProducts);
    Router.on("#/seller/inventory", viewSellerInventory);
    Router.on("#/seller/reviews", viewSellerReviews);
    Router.on("#/seller/product/new", viewProductForm);
    Router.on("#/seller/product/:id/edit", viewProductForm);
    Router.on("#/seller/orders", viewSellerOrders);
    Router.on("#/seller/promos", viewSellerCoupons);
    Router.on("#/seller/messages", viewSellerMessages);
    Router.on("#/seller/stats", viewSellerStats);
    Router.on("#/seller/clients", viewSellerClients);
    Router.on("#/messages", viewBuyerMessages);
    Router.on("#/admin", viewAdmin);
    Router.setNotFound(() => layout(emptyState("🧭", "Page introuvable", "Le lien demandé n'existe pas.", `<a href="#/" class="btn btn-primary">Retour à l'accueil</a>`)));
    // Bascule le corps en « mode vendeur » sur les routes /seller (chrome dédié).
    Router.setBeforeEach((path) => {
      document.body.classList.toggle("seller-mode", path.indexOf("#/seller") === 0);
      return true;
    });
  }

  /* ============================================================
     Initialisation
     ============================================================ */
  function init() {
    // Données de démo.
    Seed.run(false);
    // Publie les articles programmés dont l'échéance est atteinte.
    Products.processScheduled();
    // Thème persistant (ou préférence système).
    const savedTheme = DB.get(DB.KEYS.theme, null) || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);
    // Multi-langue.
    if (I18n) I18n.init();
    // Accessibilité : taille d'affichage + contraste mémorisés.
    const cu = Auth.current();
    if (cu && cu.fontScale) applyFontScale(cu.fontScale);
    if (cu && cu.highContrast) document.documentElement.setAttribute("data-contrast", "high");
    // Rappel de panier abandonné (une fois par session, après un délai).
    setTimeout(abandonedCartReminder, 60000);
    // Rappel de suivi des commandes expédiées (peu après le chargement).
    setTimeout(orderTrackingReminder, 4000);
    // En-tête + délégation + badges.
    wireHeader();
    wireGlobalDelegation();
    renderHeaderUser();
    UI.refreshBadges();
    // Assistant virtuel flottant.
    mountChatbot();
    // Bandeau confidentialité + tour de bienvenue (première visite).
    mountPrivacyBanner();
    // PWA : bouton d'installation.
    setupInstallPrompt();
    // Routeur.
    registerRoutes();
    Router.start();
    // Tour de bienvenue après le premier rendu.
    setTimeout(maybeShowWelcome, 800);
    // PWA : enregistre le service worker (uniquement en contexte sécurisé http/https).
    if (/^https?:$/.test(location.protocol) && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  /* ============================================================
     Confidentialité + onboarding première visite
     ============================================================ */
  function mountPrivacyBanner() {
    if (DB.get("privacyAck", false)) return;
    if (document.getElementById("privacyBanner")) return;
    const el = document.createElement("div");
    el.id = "privacyBanner";
    el.className = "privacy-banner";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Information sur la confidentialité");
    el.innerHTML = `
      <span>🔒 Ce site fonctionne <strong>sans serveur</strong> : vos données (compte, panier, commandes) sont stockées <strong>uniquement sur cet appareil</strong>. Aucune information n'est envoyée en ligne.</span>
      <button class="btn btn-primary btn-sm" id="privacyOk">J'ai compris</button>`;
    document.body.appendChild(el);
    document.getElementById("privacyOk").addEventListener("click", () => {
      DB.set("privacyAck", true);
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    });
  }

  function maybeShowWelcome() {
    if (DB.get("onboarded", false)) return;
    DB.set("onboarded", true);
    UI.modal({
      title: "👋 Bienvenue sur Marché CI",
      body: `<p class="text-muted" style="margin:0 0 14px;font-size:13.5px">La marketplace ivoirienne, 100 % paiement à la livraison. Voici l'essentiel :</p>
        <div class="welcome-steps">
          <div class="welcome-step"><span class="ws-ico">🛍️</span><div><strong>Parcourez & commandez</strong><div class="text-muted">Des articles de plusieurs boutiques, réunis en un seul panier.</div></div></div>
          <div class="welcome-step"><span class="ws-ico">💵</span><div><strong>Payez à la livraison</strong><div class="text-muted">En espèces, à la réception. Aucun paiement en ligne.</div></div></div>
          <div class="welcome-step"><span class="ws-ico">🏪</span><div><strong>Devenez vendeur</strong><div class="text-muted">Ouvrez votre boutique en quelques minutes.</div></div></div>
        </div>`,
      footer: `<button class="btn btn-primary btn-block" data-close>Commencer à explorer</button>`,
    });
  }

  /* ============================================================
     PWA : invite d'installation
     ============================================================ */
  let deferredInstallPrompt = null;
  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallButton();
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      const b = document.getElementById("installFab"); if (b) b.remove();
      UI.toast("Application installée ✓", "success");
    });
  }
  function showInstallButton() {
    if (DB.get("installDismissed", false)) return;
    if (document.getElementById("installFab")) return;
    const b = document.createElement("button");
    b.id = "installFab";
    b.className = "install-fab";
    b.innerHTML = `📲 Installer l'app <span class="install-close" title="Masquer">✕</span>`;
    document.body.appendChild(b);
    b.addEventListener("click", async (e) => {
      if (e.target.classList.contains("install-close")) { DB.set("installDismissed", true); b.remove(); return; }
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") b.remove();
      deferredInstallPrompt = null;
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

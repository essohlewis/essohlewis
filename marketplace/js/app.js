/* =========================================================================
   app.js — Point d'entrée : initialisation, wiring de l'en-tête, favoris,
   enregistrement des routes et rendu de toutes les vues (SPA).
   ========================================================================= */

(function () {
  "use strict";

  const { DB, UI, Auth, Store, Products, Cart, Orders, Notifications, Router, Seed } = window.MP;

  const V = () => document.getElementById("view");
  const SB = () => document.getElementById("sidebar");

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

  function layout(mainHTML, sidebarHTML) {
    V().innerHTML = mainHTML;
    SB().innerHTML = sidebarHTML || "";
    // Vide la nav basse vendeur hors des vues back-office (onboarding, client…).
    const sbn = document.getElementById("sellerBottomNav");
    if (sbn) sbn.innerHTML = "";
  }

  function requireAuth() {
    if (!Auth.isLogged()) {
      UI.toast("Veuillez vous connecter.", "info");
      Router.go("#/login");
      return false;
    }
    return true;
  }

  function requireVendor() {
    if (!requireAuth()) return false;
    if (!Store.byOwner(Auth.current().id)) {
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
      <article class="product-card" data-href="#/product/${p.id}">
        <div class="pc-media">
          <img src="${img}" alt="${UI.esc(p.title)}" loading="lazy" />
          <div class="pc-tag">
            ${p.featured ? `<span class="tag featured">★ À la une</span>` : ""}
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

  /* ============================================================
     VUE : Accueil (fil de toutes les boutiques)
     ============================================================ */
  function viewHome(params) {
    const q = params.query || {};
    const filters = {
      category: q.cat || "",
      commune: q.commune || "",
      storeId: q.store || "",
      minPrice: q.min || "",
      maxPrice: q.max || "",
      sort: q.sort || "recent",
    };

    // Squelette de chargement (effet app-like), puis rendu réel.
    layout(
      `<div class="hero-banner"><h1>Le marché en ligne de Côte d'Ivoire</h1>
        <p>Des centaines d'articles de vendeurs près de chez vous. Payez en espèces à la livraison.</p>
        <div class="hero-badges">
          <span class="hero-pill">🚚 Livraison à domicile</span>
          <span class="hero-pill">💵 Paiement à la livraison</span>
          <span class="hero-pill">🏪 ${Store.all().length} boutiques</span>
        </div></div>` +
      categoryChips(filters.category) + skeletonGrid(8),
      sidebarFilters(filters)
    );

    // Rendu différé pour laisser apparaître le squelette.
    setTimeout(() => {
      const list = Products.search(filters);
      const grid = V().querySelector(".grid");
      if (grid) grid.outerHTML = gridHTML(list, "Aucun article ne correspond à ces critères.");
      wireSidebar(filters);
      wireCategoryChips();
    }, 180);
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
        Router.go(cat ? "#/?cat=" + cat : "#/");
      })
    );
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
              <option value="price_asc" ${f.sort === "price_asc" ? "selected" : ""}>Prix croissant</option>
              <option value="price_desc" ${f.sort === "price_desc" ? "selected" : ""}>Prix décroissant</option>
            </select>
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
      </div>`;
  }

  function wireSidebar(f) {
    const sb = SB();
    if (!sb) return;
    const apply = () => {
      const q = new URLSearchParams();
      const cat = f.category;
      if (cat) q.set("cat", cat);
      const commune = sb.querySelector("#fCommune").value;
      const store = sb.querySelector("#fStore").value;
      const sort = sb.querySelector("#fSort").value;
      const min = sb.querySelector("#fMin").value;
      const max = sb.querySelector("#fMax").value;
      if (commune) q.set("commune", commune);
      if (store) q.set("store", store);
      if (sort && sort !== "recent") q.set("sort", sort);
      if (min) q.set("min", min);
      if (max) q.set("max", max);
      const qs = q.toString();
      Router.go("#/" + (qs ? "?" + qs : ""));
    };
    const applyBtn = sb.querySelector("#fApply");
    if (applyBtn) applyBtn.addEventListener("click", apply);
    const resetBtn = sb.querySelector("#fReset");
    if (resetBtn) resetBtn.addEventListener("click", () => Router.go("#/"));
    const sortSel = sb.querySelector("#fSort");
    if (sortSel) sortSel.addEventListener("change", apply);
  }

  /* ============================================================
     VUE : Recherche
     ============================================================ */
  function viewSearch(params) {
    const q = (params.query && params.query.q) || "";
    const filters = { q, sort: "recent" };
    const list = q ? Products.search(filters) : Products.published();
    layout(
      `<div class="page-head"><div>
        <div class="page-title">${q ? "Résultats" : "Explorer"}</div>
        <div class="page-sub">${q ? `${list.length} résultat(s) pour « ${UI.esc(q)} »` : "Parcourez tous les articles disponibles."}</div>
      </div></div>
      <form id="searchForm" style="margin-bottom:18px">
        <div class="field"><input type="search" id="searchQ" placeholder="Que recherchez-vous ?" value="${UI.esc(q)}" /></div>
      </form>
      ${categoryChips("")}
      ${gridHTML(list, "Aucun article ne correspond à votre recherche.")}`
    );
    wireCategoryChips();
    const form = document.getElementById("searchForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = document.getElementById("searchQ").value.trim();
      Router.go("#/search?q=" + encodeURIComponent(val));
    });
  }

  /* ============================================================
     VUE : Fiche produit
     ============================================================ */
  function viewProduct(params) {
    const p = Products.get(params.id);
    if (!p) { layout(emptyState("😕", "Article introuvable", "Cet article n'existe plus.", `<a href="#/" class="btn btn-primary">Retour à l'accueil</a>`)); return; }
    Products.addView(p.id);
    const store = Store.get(p.storeId);
    const price = Products.effectivePrice(p);
    const hasPromo = Products.promoActive(p);
    const rt = Products.rating(p.id);
    const images = (p.images && p.images.length ? p.images : [UI.placeholder(p.title)]).map((s) => UI.safeImg(s, p.title));
    const closed = !!store.closed;
    const out = p.stock <= 0 || closed;
    const favActive = Fav.has(p.id) ? "active" : "";

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
            ${hasPromo && p.promoUntil ? `<span class="tag promo" style="position:static">Jusqu'au ${UI.dateFR(p.promoUntil)}</span>` : ""}
          </div>
          <div class="text-muted" style="font-size:14px">${closed ? "🔒 Boutique fermée — commandes suspendues" : (p.stock <= 0 ? "❌ Rupture de stock" : "✅ En stock : " + p.stock + " disponible(s)")}</div>
          <p class="pd-desc">${UI.esc(p.description)}</p>
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
          <a href="#/store/${store.id}" class="store-mini">
            <img src="${UI.safeImg(store.logo, store.name)}" alt="" />
            <div style="flex:1"><div class="sm-name">${UI.esc(store.name)}</div>
              <div class="sm-meta">📍 ${UI.esc(store.commune)} · Voir la boutique →</div></div>
          </a>
        </div>
      </div>
      <div class="section-title">Avis & notes</div>
      <div class="card card-pad" id="reviewsBox">${reviewsHTML(p.id, "product")}</div>
    `);

    // --- Wiring galerie ---
    V().querySelectorAll(".pd-thumb").forEach((t) =>
      t.addEventListener("click", () => {
        V().querySelectorAll(".pd-thumb").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        document.getElementById("pdMain").src = images[Number(t.getAttribute("data-img"))];
      })
    );

    // --- Variantes ---
    function wireVariant(containerId, attr) {
      const c = document.getElementById(containerId);
      if (!c) return;
      c.querySelectorAll(".chip").forEach((b) =>
        b.addEventListener("click", () => {
          c.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
        })
      );
    }
    wireVariant("sizeOpts", "data-size");
    wireVariant("colorOpts", "data-color");

    // --- Quantité ---
    let qty = 1;
    const qtyVal = document.getElementById("qtyVal");
    document.getElementById("qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
    document.getElementById("qtyPlus").addEventListener("click", () => { qty = Math.min(p.stock || 1, qty + 1); qtyVal.textContent = qty; });

    // --- Ajout panier ---
    document.getElementById("addCart").addEventListener("click", () => {
      const variant = {};
      const sz = V().querySelector("#sizeOpts .chip.active");
      const cl = V().querySelector("#colorOpts .chip.active");
      if (sz) variant.size = sz.getAttribute("data-size");
      if (cl) variant.color = cl.getAttribute("data-color");
      const res = Cart.add(p.id, qty, variant);
      if (res.ok) UI.toast("Ajouté au panier ✓", "success");
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

    wireReviews(p.id, "product", store.ownerId);
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

    const items = list.length
      ? list.map((r) => reviewItem(r)).join("")
      : `<p class="text-muted" style="text-align:center;padding:20px 0">Aucun avis pour le moment. Soyez le premier !</p>`;
    return head + `<div class="divider"></div>` + items;
  }

  function reviewItem(r) {
    const initials = (r.userName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return `<div class="review" data-review="${r.id}">
      <div class="review-head">
        <div class="review-avatar">${UI.esc(initials)}</div>
        <div><strong>${UI.esc(r.userName)}</strong> ${UI.starsHTML(r.rating)}
          <div class="notif-time">${UI.timeAgo(r.createdAt)}</div></div>
      </div>
      ${r.comment ? `<p style="margin:6px 0 0">${UI.esc(r.comment)}</p>` : ""}
      ${r.reply ? `<div class="review-reply"><strong>Réponse du vendeur :</strong> ${UI.esc(r.reply.text)}</div>`
        : `<button class="btn btn-ghost btn-sm mt-8 reply-btn" data-reply="${r.id}" hidden>Répondre</button>`}
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
    let rating = 0;
    UI.modal({
      title: "Votre avis",
      body: `<div class="field"><label>Note</label>${starPicker("revStars")}</div>
        <div class="field mt-16"><label>Commentaire (optionnel)</label>
        <textarea id="revComment" placeholder="Partagez votre expérience…"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="submitReview">Publier</button>`,
      onMount(m, close) {
        wireStarPicker("revStars", (v) => (rating = v));
        m.querySelector("#submitReview").addEventListener("click", () => {
          if (!rating) { UI.toast("Sélectionnez une note.", "error"); return; }
          const res = Products.addReview({ targetType, targetId, rating, comment: m.querySelector("#revComment").value });
          if (res.ok) { UI.toast("Merci pour votre avis !", "success"); close(); Router.resolve(); }
          else UI.toast(res.error, "error");
        });
      },
    });
  }

  function openReplyModal(reviewId, targetId, targetType) {
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
          close(); Router.resolve();
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

    const socials = [];
    if (store.socials.instagram) socials.push(`Instagram : @${UI.esc(store.socials.instagram)}`);
    if (store.socials.facebook) socials.push(`Facebook : ${UI.esc(store.socials.facebook)}`);

    layout(`
      <div class="store-hero">
        <div class="store-banner"><img src="${UI.safeImg(store.banner, store.name)}" alt="" /></div>
        <div class="store-hero-body">
          <img class="store-logo" src="${UI.safeImg(store.logo, store.name)}" alt="${UI.esc(store.name)}" />
          <div class="store-hero-info">
            <h1>${UI.esc(store.name)}</h1>
            <div class="store-hero-meta">
              <span>📍 ${UI.esc(store.commune)}</span>
              <span>🏷️ ${UI.esc(UI.categoryLabel(store.category))}</span>
              <span>🕒 ${UI.esc(store.hours)}</span>
              <span>👥 ${subCount} abonné(s)</span>
              ${rt.count ? `<span>${UI.starsHTML(rt.avg)} (${rt.count})</span>` : ""}
            </div>
          </div>
          <div class="flex gap-8 wrap">
            ${isOwner
              ? `<a href="#/seller/dashboard" class="btn btn-ghost">Gérer ma boutique</a>`
              : `<button class="btn ${subscribed ? "btn-ghost" : "btn-primary"}" id="subBtn">${subscribed ? "✓ Abonné" : "S'abonner"}</button>`}
            ${store.whatsapp ? `<a class="btn wa-btn" href="https://wa.me/225${UI.esc(store.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.9.9-2.7-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 6 8.9c0 1.8 1.3 3.5 1.5 3.7s2.6 4 6.3 5.4c2.2.8 2.6.6 3.1.6s1.4-.6 1.6-1.1.2-1 .1-1.1-.3-.2-.5-.3z"/></svg>WhatsApp</a>` : ""}
          </div>
        </div>
      </div>
      ${store.closed ? `<div class="store-ribbon closed">🔒 Boutique momentanément fermée${store.closedMsg ? " — " + UI.esc(store.closedMsg) : ""}. Les commandes sont suspendues.</div>` : ""}
      ${store.promoBanner ? `<div class="store-ribbon promo">📣 ${UI.esc(store.promoBanner)}</div>` : ""}
      <p class="text-muted" style="max-width:720px">${UI.esc(store.description)}</p>
      ${socials.length ? `<p class="text-muted" style="font-size:13px">${socials.join(" · ")}</p>` : ""}
      <div class="section-title">Articles (${products.length})</div>
      ${gridHTML(products, "Cette boutique n'a pas encore publié d'article.")}
      <div class="section-title">Avis de la boutique</div>
      <div class="card card-pad" id="reviewsBox">${reviewsHTML(store.id, "store")}</div>
    `);

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
    if (!groups.length) {
      layout(emptyState("🛒", "Votre panier est vide", "Parcourez les boutiques et ajoutez des articles.", `<a href="#/" class="btn btn-primary">Découvrir les articles</a>`));
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
      <div class="page-head"><div><div class="page-title">Mon panier</div>
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
            <h3 style="margin:0 0 12px">Récapitulatif</h3>
            <div class="summary-row"><span>Sous-total</span><span>${UI.fcfa(total)}</span></div>
            <div class="summary-row"><span>Livraison</span><span class="text-muted">À convenir</span></div>
            <div class="summary-row total"><span>Total</span><span>${UI.fcfa(total)}</span></div>
            <button class="btn btn-primary btn-block btn-lg mt-16" id="goCheckout">Commander (${groups.length})</button>
            <button class="btn btn-ghost btn-block mt-8" id="clearCart">Vider le panier</button>
          </div>
        </div>
      </div>`);

    // Wiring des lignes.
    V().querySelectorAll("[data-line]").forEach((row) => {
      const pid = row.getAttribute("data-pid");
      const variant = JSON.parse(row.getAttribute("data-variant") || "{}");
      row.querySelector(".ci-minus").addEventListener("click", () => { changeQty(pid, variant, -1); });
      row.querySelector(".ci-plus").addEventListener("click", () => { changeQty(pid, variant, 1); });
      row.querySelector(".ci-del").addEventListener("click", () => { Cart.removeLine(pid, variant); UI.toast("Article retiré.", "info"); viewCart(); });
    });
    document.getElementById("goCheckout").addEventListener("click", () => {
      if (!Auth.isLogged()) { UI.toast("Connectez-vous pour commander.", "info"); Router.go("#/login"); return; }
      Router.go("#/checkout");
    });
    document.getElementById("clearCart").addEventListener("click", async () => {
      if (await UI.confirm("Vider entièrement votre panier ?", { danger: true, confirmLabel: "Vider" })) { Cart.clear(); viewCart(); }
    });
  }

  function cartLineHTML(l) {
    const vparts = [];
    if (l.variant && l.variant.size) vparts.push("Taille : " + l.variant.size);
    if (l.variant && l.variant.color) vparts.push("Couleur : " + l.variant.color);
    return `<div class="cart-item" data-line data-pid="${l.product.id}" data-variant='${UI.esc(JSON.stringify(l.variant || {}))}'>
      <img src="${UI.safeImg(l.product.images && l.product.images[0], l.product.title)}" alt="" />
      <div class="cart-item-info">
        <h4><a href="#/product/${l.product.id}">${UI.esc(l.product.title)}</a></h4>
        ${vparts.length ? `<div class="ci-variant">${UI.esc(vparts.join(" · "))}</div>` : ""}
        <div class="ci-price">${UI.fcfa(l.unit)}</div>
      </div>
      <div class="qty-box"><button class="ci-minus">−</button><span>${l.qty}</span><button class="ci-plus">+</button></div>
      <button class="icon-btn ci-del" title="Retirer" style="width:38px;height:38px">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12l-1 13H7zM9 4h6l1 2H8z"/></svg>
      </button>
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
    if (!requireAuth()) return;
    const groups = Cart.grouped();
    if (!groups.length) { Router.go("#/cart"); return; }
    const user = Auth.current();
    const itemsTotal = Cart.total();
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${user.commune === c ? "selected" : ""}>${c}</option>`).join("");

    layout(`
      <nav class="breadcrumb"><a href="#/cart">Panier</a> › <span>Commande</span></nav>
      <div class="cart-layout">
        <div>
          <div class="card card-pad">
            <h3 style="margin:0 0 4px">Coordonnées de livraison</h3>
            <p class="text-muted" style="margin:0 0 18px;font-size:13.5px">Le règlement s'effectue en espèces à la réception.</p>
            <form id="checkoutForm" class="form-grid">
              <div class="form-grid form-2col">
                <div class="field"><label>Nom du destinataire *</label><input id="dName" value="${UI.esc(user.name)}" required /><span class="err">Nom requis.</span></div>
                <div class="field"><label>Téléphone *</label><input id="dPhone" value="${UI.esc(user.phone)}" placeholder="07 00 00 00 00" required /><span class="err">Numéro invalide.</span></div>
              </div>
              <div class="field"><label>Commune *</label><select id="dCommune">${communeOpts}</select><span class="err">Commune requise.</span></div>
              <div class="field"><label>Adresse / point de repère *</label><textarea id="dAddress" placeholder="Ex : Riviera Palmeraie, près de la station…" required>${UI.esc(user.address)}</textarea><span class="err">Adresse requise.</span></div>
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
            <div class="summary-row total"><span>À régler à la livraison</span><span id="grandTotal">${UI.fcfa(itemsTotal)}</span></div>
            <div class="cod-note"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z"/></svg>
              <span>Paiement <strong>en espèces</strong> uniquement, à la réception.</span></div>
            <button class="btn btn-primary btn-block btn-lg mt-16" id="placeOrder">Valider la commande</button>
          </div>
        </div>
      </div>`);

    // Recalcule les frais de livraison selon la commune choisie.
    function refreshFees() {
      const commune = document.getElementById("dCommune").value;
      let fees = 0; let rows = "";
      let blocked = null;
      groups.forEach((g) => {
        const st = Store.get(g.store.id);
        if (!Store.servesCommune(st, commune)) { blocked = st.name; }
        const fee = Store.deliveryFee(st, commune);
        fees += fee;
        rows += `<div class="summary-row"><span>Livraison ${UI.esc(g.store.name)}</span><span>${fee > 0 ? UI.fcfa(fee) : "Gratuite"}</span></div>`;
      });
      document.getElementById("feeRows").innerHTML = rows;
      document.getElementById("grandTotal").textContent = UI.fcfa(itemsTotal + fees);
      const btn = document.getElementById("placeOrder");
      if (blocked) { btn.disabled = true; btn.textContent = `Non livré à ${commune}`; }
      else { btn.disabled = false; btn.textContent = "Valider la commande"; }
    }
    document.getElementById("dCommune").addEventListener("change", refreshFees);
    refreshFees();

    document.getElementById("placeOrder").addEventListener("click", () => {
      const delivery = {
        name: document.getElementById("dName").value,
        phone: document.getElementById("dPhone").value,
        commune: document.getElementById("dCommune").value,
        address: document.getElementById("dAddress").value,
        note: document.getElementById("dNote").value,
      };
      // Validation visuelle simple.
      const err = Orders.validateDelivery(delivery);
      if (err) { UI.toast(err, "error"); return; }
      // Mémorise les coordonnées sur le profil pour la prochaine fois.
      Auth.updateProfile({ phone: delivery.phone, commune: delivery.commune, address: delivery.address });
      const res = Orders.checkout(delivery);
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
            <div class="summary-row"><span>Livraison — ${UI.esc(order.delivery.commune)}</span><span>${order.deliveryFee ? UI.fcfa(order.deliveryFee) : "Gratuite"}</span></div>
            <div class="summary-row"><span>Mode de paiement</span><span>💵 Espèces à la livraison</span></div>
            <div class="summary-row total"><span>Montant à régler</span><span>${UI.fcfa(order.total)}</span></div>
          </div>
          <div class="cod-note" style="text-align:left"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 15-4-4 1.4-1.4L11 14.2l5.6-5.6L18 10z"/></svg>
            <span>Le vendeur vous contactera au <strong>${UI.esc(order.delivery.phone)}</strong> pour organiser la livraison.</span></div>
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
    if (!requireAuth()) return;
    const user = Auth.current();
    const orders = Orders.byBuyer(user.id);
    if (!orders.length) {
      layout(emptyState("📦", "Aucune commande", "Vous n'avez pas encore passé de commande.", `<a href="#/" class="btn btn-primary">Découvrir les articles</a>`));
      return;
    }
    layout(`
      <div class="page-head"><div><div class="page-title">Mes commandes</div>
        <div class="page-sub">${orders.length} commande(s)</div></div></div>
      ${orders.map((o) => orderCardBuyer(o)).join("")}`);
  }

  function orderCardBuyer(o) {
    return `<div class="card card-pad mt-16">
      <div class="flex-between wrap">
        <div><strong>N° ${UI.esc(o.number)}</strong><div class="text-muted" style="font-size:13px">${UI.dateFR(o.createdAt)} · ${UI.esc(o.storeName)}</div></div>
        <span class="status ${o.status}">${Orders.STATUS[o.status]}</span>
      </div>
      ${o.status !== "annulee" ? deliveryStepper(o.status) : ""}
      <div class="divider" style="margin:14px 0"></div>
      ${o.items.map((it) => `<div class="cart-item" style="padding:8px 0;border:none">
        <img src="${UI.safeImg(it.image, it.title)}" alt="" style="width:54px;height:54px" />
        <div class="cart-item-info"><h4><a href="#/product/${it.productId}">${UI.esc(it.title)}</a></h4>
        <div class="ci-variant">Qté : ${it.qty} × ${UI.fcfa(it.unit)}</div></div></div>`).join("")}
      ${o.deliveryFee ? `<div class="flex-between mt-8" style="font-size:13px"><span class="text-muted">Dont livraison</span><span>${UI.fcfa(o.deliveryFee)}</span></div>` : ""}
      <div class="flex-between mt-8"><span class="text-muted">💵 À payer à la livraison (${UI.esc(o.delivery.commune)})</span><strong style="font-size:17px;color:var(--brand)">${UI.fcfa(o.total)}</strong></div>
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
  function viewFavorites() {
    if (!requireAuth()) return;
    const ids = Fav.list();
    const list = ids.map((id) => Products.get(id)).filter((p) => p && p.status === "published");
    layout(`
      <div class="page-head"><div><div class="page-title">Mes favoris</div>
        <div class="page-sub">${list.length} article(s) sauvegardé(s)</div></div></div>
      ${list.length ? gridHTML(list) : emptyState("❤️", "Aucun favori", "Ajoutez des articles à vos favoris pour les retrouver ici.", `<a href="#/" class="btn btn-primary">Explorer</a>`)}`);
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

  function viewNotifications() {
    if (!requireAuth()) return;
    const user = Auth.current();
    const list = Notifications.forUser(user.id);
    layout(`
      <div class="page-head"><div><div class="page-title">Notifications</div>
        <div class="page-sub">${list.filter((n) => !n.read).length} non lue(s)</div></div>
        ${list.length ? `<div class="flex gap-8"><button class="btn btn-ghost btn-sm" id="markAll">Tout marquer lu</button><button class="btn btn-ghost btn-sm" id="clearAll">Effacer</button></div>` : ""}
      </div>
      <div class="card" style="overflow:hidden">
        ${list.length ? list.map((n) => {
          const ic = NOTIF_ICON[n.type] || NOTIF_ICON.info;
          return `<div class="notif-item ${n.read ? "" : "unread"}" data-notif="${n.id}" data-link="${UI.esc(n.link || "")}">
            <div class="notif-ico ${ic.bg}"><svg viewBox="0 0 24 24">${ic.svg}</svg></div>
            <div class="notif-body"><p>${UI.esc(n.message)}</p><div class="notif-time">${UI.timeAgo(n.createdAt)}</div></div>
          </div>`;
        }).join("") : emptyState("🔔", "Aucune notification", "Abonnez-vous à des boutiques pour être alerté de leurs nouveautés.")}
      </div>`);

    V().querySelectorAll("[data-notif]").forEach((el) =>
      el.addEventListener("click", () => {
        Notifications.markRead(el.getAttribute("data-notif"));
        const link = el.getAttribute("data-link");
        if (link) Router.go(link);
        else Router.resolve();
      })
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
    const mode = (params.query && params.query.mode) === "register" ? "register" : "login";
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
          if (res.ok) { Cart.mergeGuestInto(res.user.id); UI.toast("Connecté ✓", "success"); afterAuth(); }
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
            UI.toast("Compte créé ✓", "success");
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

    layout(`
      <div class="page-head"><div><div class="page-title">Mon profil</div>
        <div class="page-sub">${UI.esc(user.email)}</div></div></div>

      <div class="card card-pad">
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

      <div class="section-title">Espace vendeur</div>
      <div class="card card-pad">
        ${store
          ? `<div class="flex-between wrap"><div><strong>${UI.esc(store.name)}</strong><div class="text-muted" style="font-size:13px">${Products.byStore(store.id, true).length} article(s) · ${Store.subscriberCount(store.id)} abonné(s)</div></div>
             <a href="#/seller/dashboard" class="btn btn-primary">Tableau de bord</a></div>`
          : `<div class="flex-between wrap"><div><strong>Devenez vendeur</strong><div class="text-muted" style="font-size:13px">Ouvrez votre boutique et vendez en quelques minutes.</div></div>
             <a href="#/seller/store" class="btn btn-accent">Ouvrir ma boutique</a></div>`}
      </div>

      ${user.role === "admin" ? `<div class="section-title">Administration</div><div class="card card-pad"><a href="#/admin" class="btn btn-ghost">Console d'administration</a></div>` : ""}

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
    document.getElementById("logoutBtn").addEventListener("click", () => {
      Auth.logout(); renderHeaderUser(); UI.refreshBadges(); UI.toast("Déconnecté.", "info"); Router.go("#/");
    });
  }

  /* ============================================================
     VENDEUR : Création / édition de boutique
     ============================================================ */
  function viewStoreForm() {
    if (!requireAuth()) return;
    const user = Auth.current();
    const store = Store.byOwner(user.id);
    const editing = !!store;
    const s = store || {};
    const catOpts = UI.CATEGORIES.map((c) => `<option value="${c.id}" ${s.category === c.id ? "selected" : ""}>${c.icon} ${c.label}</option>`).join("");
    const communeOpts = UI.COMMUNES.map((c) => `<option value="${c}" ${s.commune === c ? "selected" : ""}>${c}</option>`).join("");

    const formCard = `
      <div class="card card-pad" style="max-width:840px">
        <form id="storeForm" class="form-grid">
          <div class="form-grid form-2col">
            <div class="field"><label>Logo</label>${uploaderHTML("logoUp", s.logo ? [s.logo] : [], false)}</div>
            <div class="field"><label>Bannière</label>${uploaderHTML("bannerUp", s.banner ? [s.banner] : [], false)}</div>
          </div>
          <div class="field"><label>Nom de la boutique *</label><input id="sName" value="${UI.esc(s.name || "")}" required /></div>
          <div class="field"><label>Description</label><textarea id="sDesc" placeholder="Présentez votre boutique…">${UI.esc(s.description || "")}</textarea></div>
          <div class="form-grid form-2col">
            <div class="field"><label>Catégorie</label><select id="sCat">${catOpts}</select></div>
            <div class="field"><label>Commune</label><select id="sCommune">${communeOpts}</select></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Horaires</label><input id="sHours" value="${UI.esc(s.hours || "Lun–Sam : 09h–19h")}" /></div>
            <div class="field"><label>WhatsApp</label><input id="sWa" value="${UI.esc(s.whatsapp || "")}" placeholder="07 00 00 00 00" /></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Instagram</label><input id="sIg" value="${UI.esc((s.socials && s.socials.instagram) || "")}" placeholder="pseudo" /></div>
            <div class="field"><label>Facebook</label><input id="sFb" value="${UI.esc((s.socials && s.socials.facebook) || "")}" placeholder="page" /></div>
          </div>
          <div class="field"><label>Objectif de vente mensuel (FCFA) <span class="hint">— suivi de progression sur votre tableau de bord</span></label>
            <input type="number" id="sGoal" min="0" value="${s.salesGoal || ""}" placeholder="Ex : 500000" /></div>

          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">Disponibilité & vitrine</h3>
          <label class="switch"><input type="checkbox" id="sClosed" ${s.closed ? "checked" : ""} /><span class="track"></span><span>Boutique fermée (mode vacances) — bloque les commandes</span></label>
          <div class="field"><label>Message d'indisponibilité</label><input id="sClosedMsg" value="${UI.esc(s.closedMsg || "")}" placeholder="Ex : De retour le 15 mars" /></div>
          <div class="field"><label>Bandeau promotionnel de la vitrine <span class="hint">(optionnel)</span></label><input id="sPromoBanner" value="${UI.esc(s.promoBanner || "")}" placeholder="Ex : -20% sur tout le pagne ce week-end !" /></div>

          <div class="divider" style="margin:6px 0"></div>
          <h3 style="margin:0;font-size:16px">Livraison</h3>
          <div class="field"><label>Frais de livraison par défaut (FCFA)</label><input type="number" id="sDefaultFee" min="0" value="${s.defaultFee || ""}" placeholder="Ex : 1000" /></div>
          <div class="field"><label>Communes desservies <span class="hint">(aucune cochée = toutes)</span></label>
            <div class="zone-chips" id="zoneChips">${UI.COMMUNES.map((c) => `<span class="zone-chip ${(s.zones || []).includes(c) ? "on" : ""}" data-zone="${UI.esc(c)}">${UI.esc(c)}</span>`).join("")}</div></div>
          <div class="field"><label>Frais spécifiques par commune <span class="hint">(vide = frais par défaut)</span></label>
            <div class="fee-grid">${UI.COMMUNES.map((c) => `<div class="fee-item"><label>${UI.esc(c)}</label><input type="number" min="0" data-fee="${UI.esc(c)}" value="${(s.deliveryFees && s.deliveryFees[c]) || ""}" placeholder="déf." /></div>`).join("")}</div></div>

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

    // Sélection des communes desservies (zones).
    V().querySelectorAll("#zoneChips .zone-chip").forEach((c) =>
      c.addEventListener("click", () => c.classList.toggle("on"))
    );

    document.getElementById("storeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      // Frais par commune (uniquement les champs renseignés).
      const deliveryFees = {};
      V().querySelectorAll("[data-fee]").forEach((inp) => {
        if (inp.value !== "" && Number(inp.value) >= 0) deliveryFees[inp.getAttribute("data-fee")] = Number(inp.value);
      });
      const zones = Array.from(V().querySelectorAll("#zoneChips .zone-chip.on")).map((c) => c.getAttribute("data-zone"));
      const data = {
        name: document.getElementById("sName").value,
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
        defaultFee: Number(document.getElementById("sDefaultFee").value) || 0,
        zones,
        deliveryFees,
        socials: { instagram: document.getElementById("sIg").value.trim(), facebook: document.getElementById("sFb").value.trim() },
      };
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
    const store = Store.byOwner(Auth.current().id);
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
      ["Logo de la boutique", !!store.logo, "#/seller/store"],
      ["Bannière", !!store.banner, "#/seller/store"],
      ["Description", (store.description || "").length > 10, "#/seller/store"],
      ["Contact WhatsApp", !!store.whatsapp, "#/seller/store"],
      ["Au moins 1 article publié", publishedCount > 0, "#/seller/product/new"],
      ["Frais de livraison configurés", (store.defaultFee || 0) > 0 || Object.keys(store.deliveryFees || {}).length > 0, "#/seller/store"],
      ["Objectif de vente défini", (store.salesGoal || 0) > 0, "#/seller/store"],
    ];
    const doneCount = checklist.filter((c) => c[1]).length;
    const completeness = Math.round((doneCount / checklist.length) * 100);

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
      actions: `<button class="btn btn-ghost" id="qrBtn">${SICON.store} QR code</button>
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
  };

  /**
   * Rend la barre de menu basse propre au vendeur (mobile). Distincte de la
   * nav client : fond sombre, bouton central « + » et un menu « Plus ».
   * @param {string} active clé de la page active
   */
  function renderSellerBottomNav(active) {
    const el = document.getElementById("sellerBottomNav");
    if (!el) return;
    const store = Store.byOwner(Auth.current().id);
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
    const store = Store.byOwner(Auth.current().id);
    const user = Auth.current();
    const items = [
      ["#/seller/store", "🏪", "Ma boutique (infos)"],
      ["#/store/" + store.id, "👁️", "Voir ma vitrine"],
      ["#/seller/product/new", "➕", "Ajouter un article"],
      ["#/seller/orders", "🧾", "Mes commandes"],
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
    const store = Store.byOwner(Auth.current().id);
    const pending = store ? Orders.byStore(store.id).filter((o) => o.status === "en_attente").length : 0;
    const nav = [
      ["dashboard", "Tableau de bord", "#/seller/dashboard", SICON.dash],
      ["products", "Mes articles", "#/seller/products", SICON.box],
      ["orders", "Commandes", "#/seller/orders", SICON.receipt],
      ["stats", "Statistiques", "#/seller/stats", SICON.chart],
      ["clients", "Clients", "#/seller/clients", SICON.users],
      ["store", "Ma boutique", "#/seller/store", SICON.store],
    ];
    const navHTML = nav.map(([k, l, h, ic]) => `
      <a href="${h}" class="ss-item ${opts.active === k ? "active" : ""}">
        <span class="ss-ico">${ic}</span><span>${l}</span>
        ${k === "orders" && pending ? `<span class="ss-badge">${pending}</span>` : ""}
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
    renderSellerBottomNav(opts.active);
  }

  function statusLabel(s) {
    return { published: "Publié", draft: "Brouillon", unpublished: "Dépublié" }[s] || s;
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
      body: `<p class="text-muted" style="margin:0 0 12px;font-size:13.5px">Importez des articles depuis un fichier <strong>.json</strong> (exporté depuis Marché CI) ou collez le contenu. Les articles sont ajoutés en <strong>brouillon</strong>.</p>
        <div class="field"><label>Fichier JSON</label><input type="file" id="impFile" accept="application/json,.json" /></div>
        <div class="field mt-8"><label>ou coller le JSON</label><textarea id="impText" placeholder='{"products":[…]}' style="min-height:120px;font-family:monospace;font-size:12px"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="impGo">Importer</button>`,
      onMount(m, close) {
        m.querySelector("#impFile").addEventListener("change", (e) => {
          const f = e.target.files[0]; if (!f) return;
          const r = new FileReader(); r.onload = () => { m.querySelector("#impText").value = r.result; }; r.readAsText(f);
        });
        m.querySelector("#impGo").addEventListener("click", () => {
          let data;
          try { data = JSON.parse(m.querySelector("#impText").value); } catch (e) { UI.toast("JSON invalide.", "error"); return; }
          const arr = Array.isArray(data) ? data : (data.products || []);
          if (!arr.length) { UI.toast("Aucun article trouvé.", "error"); return; }
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
    const store = Store.byOwner(Auth.current().id);
    const q = (params && params.query) || {};
    const statusFilter = ["published", "draft", "unpublished"].includes(q.status) ? q.status : "all";
    const search = (q.q || "").toLowerCase().trim();

    const products = Products.byStore(store.id, true).sort((a, b) => b.createdAt - a.createdAt);
    const counts = {
      all: products.length,
      published: products.filter((p) => p.status === "published").length,
      draft: products.filter((p) => p.status === "draft").length,
      unpublished: products.filter((p) => p.status === "unpublished").length,
    };
    let list = products;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search) list = list.filter((p) => p.title.toLowerCase().includes(search));

    const tabs = [["all", "Tous"], ["published", "Publiés"], ["draft", "Brouillons"], ["unpublished", "Dépubliés"]];
    const qSuffix = search ? "&q=" + encodeURIComponent(search) : "";
    const filterbar = `<div class="seller-filterbar">
      <div class="tabs">${tabs.map(([k, l]) => `<a href="#/seller/products?status=${k}${qSuffix}" class="tab ${statusFilter === k ? "active" : ""}">${l}<span class="tab-count">${counts[k]}</span></a>`).join("")}</div>
      <input type="search" id="prodSearch" class="ss-search" placeholder="Rechercher un article…" value="${UI.esc(q.q || "")}" />
    </div>`;

    const bulkBar = `<div class="bulk-bar" id="bulkBar" hidden>
      <strong id="bulkCount">0</strong> sélectionné(s)
      <button class="btn btn-sm btn-accent" data-bulk="published">Publier</button>
      <button class="btn btn-sm btn-ghost" data-bulk="unpublished">Dépublier</button>
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
        <td>${UI.fcfa(Products.effectivePrice(p))}${Products.promoActive(p) ? ` <span class="text-muted" style="text-decoration:line-through;font-size:12px">${UI.fcfa(p.price)}</span>` : ""}</td>
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
      } else {
        ids.forEach((id) => { const p = Products.get(id); if (p) Products.update(id, Object.assign({}, p, { status: action })); });
        UI.toast(`${ids.length} article(s) ${action === "published" ? "publié(s)" : "dépublié(s)"} ✓`, "success");
      }
      viewSellerProducts(params);
    }));
  }

  /* ============================================================
     VENDEUR : Formulaire article (création / édition)
     ============================================================ */
  function viewProductForm(params) {
    if (!requireVendor()) return;
    const editing = !!params.id;
    const p = editing ? Products.get(params.id) : null;
    if (editing && !p) { layout(emptyState("😕", "Article introuvable", "")); return; }
    const store = Store.byOwner(Auth.current().id);
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
          <div class="form-grid form-2col">
            <div class="field"><label>Fin de promo (optionnel) <span class="hint">— au-delà, le prix normal revient</span></label>
              <input type="date" id="pPromoUntil" value="${d.promoUntil ? new Date(d.promoUntil).toISOString().slice(0, 10) : ""}" /></div>
            <div class="field"><label>Mise en avant</label>
              <label class="switch" style="margin-top:8px"><input type="checkbox" id="pFeatured" ${d.featured ? "checked" : ""} /><span class="track"></span><span>Article « à la une » (affiché en premier)</span></label></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Stock</label><input type="number" id="pStock" value="${d.stock != null ? d.stock : 1}" min="0" /></div>
            <div class="field"><label>Catégorie</label><select id="pCat">${catOpts}</select></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>État</label><select id="pCond">
              <option value="neuf" ${d.condition !== "occasion" ? "selected" : ""}>Neuf</option>
              <option value="occasion" ${d.condition === "occasion" ? "selected" : ""}>Occasion</option>
            </select></div>
            <div class="field"><label>Statut</label><select id="pStatus">
              <option value="published" ${d.status === "published" || !editing ? "selected" : ""}>Publié</option>
              <option value="draft" ${d.status === "draft" ? "selected" : ""}>Brouillon</option>
              <option value="unpublished" ${d.status === "unpublished" ? "selected" : ""}>Dépublié</option>
            </select></div>
          </div>
          <div class="form-grid form-2col">
            <div class="field"><label>Tailles (séparées par des virgules)</label><input id="pSizes" value="${UI.esc((d.variants && d.variants.sizes || []).join(", "))}" placeholder="S, M, L, XL" /></div>
            <div class="field"><label>Couleurs (séparées par des virgules)</label><input id="pColors" value="${UI.esc((d.variants && d.variants.colors || []).join(", "))}" placeholder="Rouge, Bleu" /></div>
          </div>
          <div class="flex gap-12">
            <button class="btn btn-primary btn-lg" type="submit">${editing ? "Enregistrer" : "Publier l'article"}</button>
            <a href="#/seller/products" class="btn btn-ghost btn-lg">Annuler</a>
          </div>
        </form>
      </div>`,
    });

    const up = wireUploader("prodImgs", d.images || [], true);

    document.getElementById("prodForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const parseList = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
      const data = {
        title: document.getElementById("pTitle").value,
        description: document.getElementById("pDesc").value,
        price: document.getElementById("pPrice").value,
        promoPrice: document.getElementById("pPromo").value,
        stock: document.getElementById("pStock").value,
        category: document.getElementById("pCat").value,
        condition: document.getElementById("pCond").value,
        status: document.getElementById("pStatus").value,
        featured: document.getElementById("pFeatured").checked,
        promoUntil: document.getElementById("pPromoUntil").value ? new Date(document.getElementById("pPromoUntil").value).getTime() : 0,
        images: up.get(),
        variants: { sizes: parseList(document.getElementById("pSizes").value), colors: parseList(document.getElementById("pColors").value) },
      };
      const res = editing ? Products.update(p.id, data) : Products.create(data);
      if (res.ok) { UI.toast(editing ? "Article mis à jour ✓" : "Article publié ✓", "success"); Router.go("#/seller/products"); }
      else UI.toast(res.error, "error");
    });
  }

  /* ============================================================
     VENDEUR : Commandes reçues
     ============================================================ */
  function viewSellerOrders(params) {
    if (!requireVendor()) return;
    const store = Store.byOwner(Auth.current().id);
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
    V().querySelectorAll("[data-paid]").forEach((b) =>
      b.addEventListener("click", () => {
        const o = Orders.get(b.getAttribute("data-paid"));
        Orders.setPaid(o.id, !o.paid);
        UI.toast(!o.paid ? "Marqué encaissé ✓" : "Marqué non encaissé.", "success");
        viewSellerOrders(params);
      })
    );
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
      <div class="flex-between" style="font-size:13px"><span class="text-muted">Livraison (${UI.esc(o.delivery.commune)})</span><span>${o.deliveryFee ? UI.fcfa(o.deliveryFee) : "Gratuite"}</span></div>
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
        <a class="btn wa-btn btn-sm" href="https://wa.me/225${UI.esc(o.delivery.phone.replace(/\D/g, ""))}" target="_blank" rel="noopener">${SICON.wa} Contacter</a>
      </div>
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
    const store = Store.byOwner(Auth.current().id);
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

        <div class="card card-pad mt-16">
          <div class="panel-head"><h3>Outils & données</h3></div>
          <div class="flex gap-8 wrap">
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
    const store = Store.byOwner(Auth.current().id);
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
    const clients = Object.values(map).sort((a, b) => b.total - a.total);
    const totalRevenue = clients.reduce((s, c) => s + c.total, 0);

    sellerLayout({
      active: "clients",
      title: "Mes clients",
      subtitle: `${clients.length} client(s) · ${UI.fcfa(totalRevenue)} de commandes`,
      actions: "",
      body: clients.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Client</th><th>Commune</th><th>Commandes</th><th>Total</th><th>Dernière</th><th></th></tr></thead>
        <tbody>${clients.map((c) => `<tr>
          <td><div class="flex gap-8" style="align-items:center"><div class="review-avatar">${UI.esc((c.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
            <div><strong>${UI.esc(c.name)}</strong>${c.count >= 3 ? ` <span class="tag featured" style="position:static">Fidèle</span>` : ""}<div class="text-muted" style="font-size:12px">${UI.esc(c.phone)}</div></div></div></td>
          <td>${UI.esc(c.commune)}</td>
          <td>${c.count}</td>
          <td style="font-weight:700;color:var(--brand)">${UI.fcfa(c.total)}</td>
          <td>${UI.timeAgo(c.last)}</td>
          <td><a class="btn wa-btn btn-sm" href="https://wa.me/225${UI.esc(String(c.phone).replace(/\D/g, ""))}" target="_blank" rel="noopener">${SICON.wa} Contacter</a></td>
        </tr>`).join("")}</tbody></table></div>`
        : emptyState("👥", "Aucun client", "Vos clients apparaîtront ici après leur première commande."),
    });
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

  function wireUploader(id, initial, multiple) {
    let images = (initial || []).slice();
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
      for (const f of files) {
        try {
          const url = await UI.fileToDataURL(f);
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
    document.getElementById("avatarInitials").textContent = user ? initials : "👤";

    const dd = document.getElementById("userDropdown");
    if (!user) {
      dd.innerHTML = `
        <a href="#/login" class="dd-item">🔑 Se connecter</a>
        <a href="#/login?mode=register" class="dd-item">📝 Créer un compte</a>
        <div class="divider" style="margin:6px 0"></div>
        <a href="#/login?mode=register" class="dd-item">🏪 Devenir vendeur</a>`;
    } else {
      const store = Store.byOwner(user.id);
      dd.innerHTML = `
        <div class="dd-head"><div class="dd-name">${UI.esc(user.name)}</div><div class="dd-mail">${UI.esc(user.email)}</div>
          <span class="dd-role">${user.role === "admin" ? "Admin" : user.role === "vendor" ? "Vendeur" : "Client"}</span></div>
        <a href="#/profile" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/></svg>Mon profil</a>
        <a href="#/orders" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4V2h10v2h4v2h-2v14H5V6H3V4z"/></svg>Mes commandes</a>
        <a href="#/favorites" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-6.7-4.35-9.33-8.36C.9 9.7 2.1 6 5.4 6a4.3 4.3 0 0 1 3.6 2 4.3 4.3 0 0 1 3.6-2c3.3 0 4.5 3.7 2.73 6.64C18.7 16.65 12 21 12 21z"/></svg>Mes favoris</a>
        ${store
          ? `<a href="#/seller/dashboard" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10 3h8v5h-8z"/></svg>Espace vendeur</a>`
          : `<a href="#/seller/store" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16l1 5-2 1v10H5V10L3 9zm3 8v6h4v-4h2v4h4v-6z"/></svg>Ouvrir ma boutique</a>`}
        ${user.role === "admin" ? `<a href="#/admin" class="dd-item"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z"/></svg>Administration</a>` : ""}
        <div class="divider" style="margin:6px 0"></div>
        <button class="dd-item danger" id="ddLogout"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>Se déconnecter</button>`;
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
    // Recherche.
    document.getElementById("headerSearchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = document.getElementById("headerSearchInput").value.trim();
      Router.go("#/search?q=" + encodeURIComponent(v));
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
  }

  /* ============================================================
     Enregistrement des routes
     ============================================================ */
  function registerRoutes() {
    Router.on("#/", viewHome);
    Router.on("#/search", viewSearch);
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
    Router.on("#/seller/product/new", viewProductForm);
    Router.on("#/seller/product/:id/edit", viewProductForm);
    Router.on("#/seller/orders", viewSellerOrders);
    Router.on("#/seller/stats", viewSellerStats);
    Router.on("#/seller/clients", viewSellerClients);
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
    // Thème persistant (ou préférence système).
    const savedTheme = DB.get(DB.KEYS.theme, null) || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);
    // En-tête + délégation + badges.
    wireHeader();
    wireGlobalDelegation();
    renderHeaderUser();
    UI.refreshBadges();
    // Routeur.
    registerRoutes();
    Router.start();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

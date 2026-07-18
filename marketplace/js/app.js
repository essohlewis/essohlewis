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
    const hasPromo = p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price;
    const rt = Products.rating(p.id);
    const out = p.stock <= 0;
    const img = UI.safeImg(p.images && p.images[0], p.title);
    const favActive = Fav.has(p.id) ? "active" : "";
    return `
      <article class="product-card" data-href="#/product/${p.id}">
        <div class="pc-media">
          <img src="${img}" alt="${UI.esc(p.title)}" loading="lazy" />
          <div class="pc-tag">
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
    const hasPromo = p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price;
    const rt = Products.rating(p.id);
    const images = (p.images && p.images.length ? p.images : [UI.placeholder(p.title)]).map((s) => UI.safeImg(s, p.title));
    const out = p.stock <= 0;
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
          </div>
          <div class="text-muted" style="font-size:14px">${out ? "❌ Rupture de stock" : "✅ En stock : " + p.stock + " disponible(s)"}</div>
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
    const products = Products.byStore(store.id);
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
    const total = Cart.total();
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
            <div class="summary-row"><span>${Cart.count()} article(s)</span><span>${UI.fcfa(total)}</span></div>
            <div class="summary-row"><span>Boutiques</span><span>${groups.length}</span></div>
            <div class="summary-row total"><span>À régler à la livraison</span><span>${UI.fcfa(total)}</span></div>
            <div class="cod-note"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z"/></svg>
              <span>Paiement <strong>en espèces</strong> uniquement, à la réception.</span></div>
            <button class="btn btn-primary btn-block btn-lg mt-16" id="placeOrder">Valider la commande</button>
          </div>
        </div>
      </div>`);

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
            <div class="summary-row"><span>Articles</span><span>${order.items.reduce((s, i) => s + i.qty, 0)}</span></div>
            <div class="summary-row"><span>Livraison</span><span>${UI.esc(order.delivery.commune)}</span></div>
            <div class="summary-row"><span>Mode de paiement</span><span>💵 Espèces à la livraison</span></div>
            <div class="summary-row total"><span>Montant</span><span>${UI.fcfa(order.total)}</span></div>
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
      <div class="divider" style="margin:14px 0"></div>
      ${o.items.map((it) => `<div class="cart-item" style="padding:8px 0;border:none">
        <img src="${UI.safeImg(it.image, it.title)}" alt="" style="width:54px;height:54px" />
        <div class="cart-item-info"><h4><a href="#/product/${it.productId}">${UI.esc(it.title)}</a></h4>
        <div class="ci-variant">Qté : ${it.qty} × ${UI.fcfa(it.unit)}</div></div></div>`).join("")}
      <div class="flex-between mt-8"><span class="text-muted">💵 À payer à la livraison (${UI.esc(o.delivery.commune)})</span><strong style="font-size:17px;color:var(--brand)">${UI.fcfa(o.total)}</strong></div>
    </div>`;
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

    document.getElementById("storeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById("sName").value,
        description: document.getElementById("sDesc").value,
        category: document.getElementById("sCat").value,
        commune: document.getElementById("sCommune").value,
        hours: document.getElementById("sHours").value,
        whatsapp: document.getElementById("sWa").value,
        logo: logoUp.get()[0] || "",
        banner: bannerUp.get()[0] || "",
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

    sellerLayout({
      active: "dashboard",
      title: "Tableau de bord",
      subtitle: `Bonjour ${firstName} — voici l'activité de votre boutique.`,
      actions: `<a href="#/seller/product/new" class="btn btn-primary">+ Nouvel article</a>
                <a href="#/store/${store.id}" class="btn btn-ghost">Voir ma vitrine</a>`,
      body: `
        <div class="stat-grid">
          ${statCard("ic-green", "💰", UI.fcfa(store.revenueSim || 0), "Chiffre d'affaires")}
          ${statCard("ic-orange", "📦", publishedCount + " / " + products.length, "Articles publiés")}
          ${statCard("ic-blue", "🧾", orders.length, "Commandes reçues")}
          ${statCard("ic-purple", "👥", Store.subscriberCount(store.id), "Abonnés")}
        </div>
        ${pending ? `<div class="cod-note mt-16"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>
          <span><strong>${pending} commande(s) en attente</strong> — <a href="#/seller/orders" style="color:var(--brand);font-weight:700">à traiter maintenant</a>.</span></div>` : ""}

        <div class="seller-cols">
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

    const table = list.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Article</th><th>Prix</th><th>Stock</th><th>Vues</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead>
      <tbody>${list.map((p) => `<tr>
        <td><div class="flex gap-8" style="align-items:center"><img class="mini-thumb" src="${UI.safeImg(p.images && p.images[0], p.title)}" alt=""/>
          <div><a href="#/product/${p.id}" style="font-weight:600">${UI.esc(p.title)}</a>
          <div class="text-muted" style="font-size:12px">${UI.esc(UI.categoryLabel(p.category))} · ${p.condition === "occasion" ? "Occasion" : "Neuf"}</div></div></div></td>
        <td>${UI.fcfa(Products.effectivePrice(p))}${p.promoPrice ? ` <span class="text-muted" style="text-decoration:line-through;font-size:12px">${UI.fcfa(p.price)}</span>` : ""}</td>
        <td>${p.stock <= 0 ? `<span class="status annulee">Rupture</span>` : p.stock}</td>
        <td>👁️ ${p.views || 0}</td>
        <td><span class="status ${p.status}">${statusLabel(p.status)}</span></td>
        <td><div class="row-actions">
          <a class="icon-action" href="#/product/${p.id}" title="Voir la page publique">${SICON.eye}</a>
          <button class="icon-action" data-edit="${p.id}" title="Modifier">${SICON.pencil}</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${p.id}" title="${p.status === "published" ? "Dépublier" : "Publier"}">${p.status === "published" ? "Dépublier" : "Publier"}</button>
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
      actions: `<a href="#/seller/product/new" class="btn btn-primary">+ Nouvel article</a>`,
      body: filterbar + table,
    });

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
    const orders = Orders.byStore(store.id);

    const counts = { all: orders.length };
    Object.keys(Orders.STATUS).forEach((k) => (counts[k] = orders.filter((o) => o.status === k).length));
    const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);

    const tabs = [["all", "Toutes"]].concat(Object.keys(Orders.STATUS).map((k) => [k, Orders.STATUS[k]]));
    const filterbar = `<div class="seller-filterbar"><div class="tabs">
      ${tabs.map(([k, l]) => `<a href="#/seller/orders${k === "all" ? "" : "?status=" + k}" class="tab ${filter === k ? "active" : ""}">${l}<span class="tab-count">${counts[k] || 0}</span></a>`).join("")}
    </div></div>`;

    sellerLayout({
      active: "orders",
      title: "Commandes reçues",
      subtitle: `${counts.all} commande(s) · ${counts.en_attente || 0} en attente`,
      actions: `<a href="#/store/${store.id}" class="btn btn-ghost">Voir ma vitrine</a>`,
      body: filterbar + (list.length ? list.map((o) => sellerOrderCard(o)).join("")
        : (orders.length
          ? `<div class="card card-pad"><p class="text-muted" style="text-align:center;margin:0;padding:20px 0">Aucune commande avec ce statut.</p></div>`
          : emptyState("🧾", "Aucune commande", "Les commandes de vos clients apparaîtront ici dès le premier achat."))),
    });

    V().querySelectorAll("[data-status]").forEach((sel) =>
      sel.addEventListener("change", () => {
        Orders.setStatus(sel.getAttribute("data-order"), sel.value);
        UI.toast("Statut mis à jour ✓ Le client est notifié.", "success");
        viewSellerOrders(params);
      })
    );
  }

  function sellerOrderCard(o) {
    const opts = Object.keys(Orders.STATUS).map((k) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${Orders.STATUS[k]}</option>`).join("");
    return `<div class="card card-pad mt-16">
      <div class="flex-between wrap">
        <div><strong>N° ${UI.esc(o.number)}</strong> <span class="status ${o.status}">${Orders.STATUS[o.status]}</span>
          <div class="text-muted" style="font-size:13px">${UI.dateFR(o.createdAt)} · ${UI.esc(o.buyerName)}</div></div>
        <select class="field" style="width:auto;padding:8px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--surface-2)" data-status data-order="${o.id}">${opts}</select>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      ${o.items.map((it) => `<div class="cart-item" style="padding:8px 0;border:none">
        <img src="${UI.safeImg(it.image, it.title)}" style="width:50px;height:50px" alt=""/>
        <div class="cart-item-info"><h4>${UI.esc(it.title)}</h4><div class="ci-variant">Qté : ${it.qty} × ${UI.fcfa(it.unit)}</div></div>
        <strong>${UI.fcfa(it.unit * it.qty)}</strong></div>`).join("")}
      <div class="divider" style="margin:12px 0"></div>
      <div class="flex-between wrap" style="align-items:flex-start">
        <div style="font-size:13.5px"><strong>📍 Livraison :</strong> ${UI.esc(o.delivery.name)} · ${UI.esc(o.delivery.phone)}<br>
          ${UI.esc(o.delivery.commune)} — ${UI.esc(o.delivery.address)}${o.delivery.note ? `<br><em class="text-muted">Note : ${UI.esc(o.delivery.note)}</em>` : ""}</div>
        <div style="text-align:right"><div class="text-muted" style="font-size:12px">💵 Espèces à la livraison</div>
          <strong style="font-size:18px;color:var(--brand)">${UI.fcfa(o.total)}</strong></div>
      </div>
    </div>`;
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

/* =========================================================================
   api.js — Pont entre la marketplace front et la base de données SQLite du
   backend Node (voir server/shop.js). Quand le serveur est présent (http/https),
   les inscriptions, connexions et commandes sont *aussi* écrites en base
   (write-through), et le catalogue serveur peut être consulté. En ouverture
   directe (file://) ou sans serveur, tout est neutralisé : la marketplace
   continue de fonctionner à 100 % en localStorage, sans aucun changement.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const API = { enabled: false, ready: null, productCount: 0, adminToken: "admin-demo-token" };
  const TOKEN_KEY = "marchesci_shopToken";
  function adminUrl() { return "/admin/shop?token=" + encodeURIComponent(API.adminToken); }

  function base() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return null;
    return "/api/shop";
  }
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function headers() {
    const h = { "Content-Type": "application/json" };
    const t = token(); if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }
  async function post(path, body) {
    const b = base(); if (!b) return null;
    const r = await fetch(b + path, { method: "POST", headers: headers(), body: JSON.stringify(body || {}) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  }
  async function put(path, body) {
    const b = base(); if (!b) return null;
    const r = await fetch(b + path, { method: "PUT", headers: headers(), body: JSON.stringify(body || {}) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  }
  async function get(path) {
    const b = base(); if (!b) return null;
    const r = await fetch(b + path, { headers: headers() });
    return r.json().catch(() => ({}));
  }

  /** Détecte le backend et sa base de données. */
  function init() {
    API.ready = (async () => {
      const b = base(); if (!b) { API.enabled = false; return; }
      try {
        const j = await (await fetch(b + "/health", { cache: "no-store" })).json();
        API.enabled = !!(j && j.ok && j.db);
        API.productCount = (j && j.products) || 0;
        if (API.enabled && token()) { try { await pullCollections(); await pullSynced(); } catch (e) {} }
        // Synchro multi‑appareils : re-tirer favoris/souhaits au retour sur l'onglet.
        if (API.enabled) {
          let last = 0;
          const refresh = () => { if (!token() || document.hidden) return; const t = Date.now(); if (t - last < 3000) return; last = t; pullSynced(); };
          document.addEventListener("visibilitychange", refresh);
          window.addEventListener("focus", refresh);
        }
      } catch (e) { API.enabled = false; }
    })();
    return API.ready;
  }

  /* --------------------------- Comptes (write-through) --------------------------- */
  // Dernière opération d'authentification en cours : les commandes l'attendent
  // pour être rattachées au bon compte (évite une course inscription/commande).
  let authOp = Promise.resolve();

  async function _register(user, password) {
    try {
      const r = await post("/register", { name: user.name, email: user.email, phone: user.phone, password });
      if (r && r.json && r.json.ok) { setToken(r.json.token); return; }
      const l = await post("/login", { email: user.email, password });
      if (l && l.json && l.json.ok) setToken(l.json.token);
    } catch (e) {}
  }
  async function _login(email, password) {
    try {
      const l = await post("/login", { email, password });
      if (l && l.json && l.json.ok) { setToken(l.json.token); return; }
      const u = window.MP.Auth && window.MP.Auth.current && window.MP.Auth.current();
      const r = await post("/register", { name: u ? u.name : "", email, phone: u ? u.phone : "", password });
      if (r && r.json && r.json.ok) setToken(r.json.token);
    } catch (e) {}
  }
  function syncRegister(user, password) {
    if (!API.enabled || !user || !password) return authOp;
    authOp = _register(user, password);
    authOp.then(() => pullCollections()).then(() => pullSynced());   // restaure + synchro multi‑appareils
    return authOp;
  }
  function syncLogin(email, password) {
    if (!API.enabled) return authOp;
    authOp = _login(email, password);
    authOp.then(() => pullCollections()).then(() => pullSynced());
    return authOp;
  }
  function logout() { if (API.enabled) { post("/logout", {}).catch(() => {}); } setToken(""); authOp = Promise.resolve(); try { localStorage.removeItem(META_KEY); } catch (e) {} }

  /* --------------------------- Commandes (write-through) -------------------------- */
  async function syncOrders(orders) {
    if (!API.enabled || !Array.isArray(orders)) return;
    // Attend qu'une inscription/connexion en cours ait posé le jeton de session,
    // pour rattacher la commande au compte plutôt que de la créer en « invité ».
    try { await authOp; } catch (e) {}
    for (const o of orders) {
      const body = {
        items: (o.items || []).map((i) => ({
          productId: i.productId, name: i.title, price: i.unit, qty: i.qty,
          variant: i.variant && Object.keys(i.variant).length ? JSON.stringify(i.variant) : "",
          storeId: o.storeId || "", storeName: o.storeName || "",
        })),
        customerName: o.delivery ? o.delivery.name : o.buyerName,
        phone: o.delivery ? o.delivery.phone : "",
        address: o.delivery ? o.delivery.address : "",
        city: o.delivery ? o.delivery.commune : "",
        deliveryFee: o.deliveryFee || 0,
        discount: o.discount || 0,
        note: "Réf. " + (o.number || o.id) + (o.storeName ? " — " + o.storeName : ""),
        payment: "cod",
        paymentMethod: o.paymentMethod || "cod",
      };
      try { await post("/orders", body); } catch (e) {}
    }
  }

  /* ------------------------------- Paiement --------------------------------------- */
  async function paymentMethods() {
    if (!API.enabled) return [];
    try { const j = await get("/payments/methods"); return (j && j.methods) || []; } catch (e) { return []; }
  }
  async function initiatePayment(orderId, method, phone) {
    if (!API.enabled) return null;
    try { const r = await post("/payments/initiate", { orderId, method, phone }); return r && r.json; } catch (e) { return null; }
  }
  async function confirmPayment(paymentId) {
    if (!API.enabled) return null;
    try { const r = await post("/payments/" + encodeURIComponent(paymentId) + "/confirm", {}); return r && r.json; } catch (e) { return null; }
  }
  // Commandes du client en attente de paiement (mobile money / carte).
  async function pendingPayments() {
    if (!API.enabled || !token()) return [];
    try { const j = await get("/orders"); return ((j && j.items) || []).filter((o) => o.paymentStatus === "pending"); } catch (e) { return []; }
  }

  /* -------------------------- Boutique (write-through) ---------------------------- */
  async function syncStore(store) {
    if (!API.enabled || !store) return;
    try {
      await authOp;
      if (!token()) return;
      await post("/stores", {
        id: store.id, name: store.name, description: store.description,
        category: store.category, commune: store.commune, logo: store.logo, approved: !!store.approved,
      });
    } catch (e) {}
  }

  /* ---------------------------- Avis (write-through) ------------------------------ */
  async function syncReview(review) {
    if (!API.enabled || !review) return;
    try {
      await authOp;               // attend que l'inscription/connexion ait posé le jeton
      if (!token()) return;       // avis réservé aux clients connectés
      await post("/reviews", {
        targetType: review.targetType, targetId: review.targetId, rating: review.rating,
        comment: review.comment, verified: !!review.verified, authorName: review.userName,
      });
    } catch (e) {}
  }

  /* --------------- Collections génériques (favoris, souhaits, coupons, …) --------- */
  // Collections à VRAIE synchro multi‑appareils (dernier écrivain gagne, par
  // horodatage serveur) : on tire la version distante plus récente à l'ouverture.
  const MULTI_DEVICE = ["favorites", "wishlists"];
  const META_KEY = "marchesci_syncMeta";
  function syncMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch (e) { return {}; } }
  function setSyncMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }
  function markSynced(collection, updatedAt) { if (!updatedAt) return; const m = syncMeta(); m[collection] = updatedAt; setSyncMeta(m); }

  // Mirroring d'une collection localStorage vers la base (par compte connecté).
  async function syncCollection(collection, value) {
    if (!API.enabled) return;
    try {
      await authOp;
      if (!token()) return;                 // réservé aux comptes connectés
      const r = await put("/data/" + encodeURIComponent(collection), { data: value });
      if (r && r.json && r.json.ok) markSynced(collection, r.json.updatedAt);
    } catch (e) {}
  }

  // Synchro multi‑appareils : pour favoris/souhaits, adopte la version serveur si
  // elle est plus récente que la dernière connue localement (dernier écrivain
  // gagne). Applique en « silencieux » (pas de renvoi) puis rafraîchit l'écran.
  async function pullSynced(collections) {
    if (!API.enabled || !token()) return false;
    const DB = window.MP.DB; if (!DB) return false;
    let changed = false;
    try {
      const j = await get("/data/meta");
      const meta = (j && j.meta) || {};
      const local = syncMeta();
      for (const c of (collections || MULTI_DEVICE)) {
        const remoteTs = meta[c] || 0;
        if (remoteTs && remoteTs > (local[c] || 0)) {
          const d = await get("/data/" + encodeURIComponent(c));
          if (d && d.ok && d.data != null) { DB.setSilent(c, d.data); markSynced(c, d.updatedAt || remoteTs); changed = true; }
        }
      }
    } catch (e) {}
    // Rafraîchit la vue courante si des données ont changé (favoris, souhaits…).
    if (changed && window.MP.Router && window.MP.Router.resolve) { try { window.MP.Router.resolve(); } catch (e) {} }
    return changed;
  }
  // Restaure depuis la base les collections localement absentes (non destructif).
  // Appelé une fois la session établie (n'attend pas authOp, pour éviter tout blocage).
  async function pullCollections() {
    if (!API.enabled || !token()) return {};
    try {
      const j = await get("/data");
      const cols = (j && j.collections) || {};
      const DB = window.MP.DB;
      if (DB) Object.keys(cols).forEach((k) => {
        const local = DB.get(k, null);
        const empty = local == null || (Array.isArray(local) && !local.length) ||
          (typeof local === "object" && !Array.isArray(local) && !Object.keys(local).length);
        if (empty && cols[k] != null) DB.set(k, cols[k]);   // remplit seulement si vide
      });
      return cols;
    } catch (e) { return {}; }
  }

  /* --------------------------- Consultations (lecture) ---------------------------- */
  async function reviewsFor(targetType, targetId) {
    if (!API.enabled) return { items: [], rating: null };
    const j = await get("/reviews?targetType=" + encodeURIComponent(targetType) + "&targetId=" + encodeURIComponent(targetId));
    return { items: (j && j.items) || [], rating: (j && j.rating) || null };
  }
  async function products(params) {
    if (!API.enabled) return [];
    const qs = new URLSearchParams(params || {}).toString();
    const j = await get("/products" + (qs ? "?" + qs : ""));
    return (j && j.items) || [];
  }
  // Recherche plein texte serveur (pertinence + tolérance aux fautes).
  // Renvoie les identifiants de produits classés par pertinence, ou null si indispo.
  async function searchProducts(q, params) {
    if (!API.enabled || !q) return null;
    try {
      const qs = new URLSearchParams(Object.assign({ q }, params || {})).toString();
      const j = await get("/products/search?" + qs);
      return j && j.ok ? (j.items || []).map((p) => p.id) : null;
    } catch (e) { return null; }
  }
  // Recommandations : identifiants de produits (ou null si indisponible).
  async function relatedProducts(id, limit) {
    if (!API.enabled || !id) return null;
    try { const j = await get("/products/" + encodeURIComponent(id) + "/related?limit=" + (limit || 4)); return j && j.ok ? (j.items || []).map((p) => p.id) : null; } catch (e) { return null; }
  }
  async function recommendations(limit) {
    if (!API.enabled) return null;
    try { const j = await get("/recommendations?limit=" + (limit || 8)); return j && j.ok ? (j.items || []).map((p) => p.id) : null; } catch (e) { return null; }
  }
  async function myOrders() {
    if (!API.enabled || !token()) return [];
    const j = await get("/orders");
    return (j && j.items) || [];
  }
  // Fidélité : { balance, rules:{earnRate, redeemValue}, ledger } — null si indisponible.
  async function loyalty() {
    if (!API.enabled || !token()) return null;
    try { const j = await get("/loyalty"); return j && j.ok ? j : null; } catch (e) { return null; }
  }

  /* -------------------- Questions / réponses produit ------------------------- */
  async function questionsFor(productId) {
    if (!API.enabled) return [];
    try { const j = await get("/questions?productId=" + encodeURIComponent(productId)); return (j && j.items) || []; } catch (e) { return []; }
  }
  async function askQuestion(productId, storeId, question) {
    if (!API.enabled) return null;
    try { await authOp; if (!token()) return null; const r = await post("/questions", { productId, storeId, question }); return r && r.json; } catch (e) { return null; }
  }
  async function answerQuestion(id, answer) {
    if (!API.enabled || !token()) return null;
    try { const r = await post("/questions/" + encodeURIComponent(id) + "/answer", { answer }); return r && r.json; } catch (e) { return null; }
  }

  API.init = init;
  API.syncRegister = syncRegister;
  API.syncLogin = syncLogin;
  API.logout = logout;
  API.syncOrders = syncOrders;
  API.syncReview = syncReview;
  API.syncStore = syncStore;
  API.salesUrl = function () { return "/mes-ventes"; };
  API.payUrl = function () { return "/paiement"; };
  API.paymentMethods = paymentMethods;
  API.initiatePayment = initiatePayment;
  API.confirmPayment = confirmPayment;
  API.pendingPayments = pendingPayments;
  API.syncCollection = syncCollection;
  API.pullCollections = pullCollections;
  API.pullSynced = pullSynced;
  API.reviewsFor = reviewsFor;
  API.products = products;      // fonction (le nombre est dans API.productCount)
  API.searchProducts = searchProducts;
  API.relatedProducts = relatedProducts;
  API.recommendations = recommendations;
  API.myOrders = myOrders;
  API.loyalty = loyalty;
  API.questionsFor = questionsFor;
  API.askQuestion = askQuestion;
  API.answerQuestion = answerQuestion;
  API.token = token;
  API.adminUrl = adminUrl;
  API.ordersUrl = function () { return "/mes-commandes"; };
  API.hasSession = function () { return !!token(); };
  window.MP.Api = API;
})();

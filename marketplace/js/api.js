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
      } catch (e) { API.enabled = false; }
    })();
    return API.ready;
  }

  /* --------------------------- Comptes (write-through) --------------------------- */
  async function syncRegister(user, password) {
    if (!API.enabled || !user || !password) return;
    try {
      const r = await post("/register", { name: user.name, email: user.email, phone: user.phone, password });
      if (r && r.json && r.json.ok) { setToken(r.json.token); return; }
      // E-mail déjà en base → on tente de récupérer une session.
      const l = await post("/login", { email: user.email, password });
      if (l && l.json && l.json.ok) setToken(l.json.token);
    } catch (e) {}
  }
  async function syncLogin(email, password) {
    if (!API.enabled) return;
    try {
      const l = await post("/login", { email, password });
      if (l && l.json && l.json.ok) { setToken(l.json.token); return; }
      // Compte créé hors-ligne (avant l'arrivée du serveur) → on l'enregistre en base.
      const u = window.MP.Auth && window.MP.Auth.current && window.MP.Auth.current();
      const r = await post("/register", { name: u ? u.name : "", email, phone: u ? u.phone : "", password });
      if (r && r.json && r.json.ok) setToken(r.json.token);
    } catch (e) {}
  }
  function logout() { if (API.enabled) { post("/logout", {}).catch(() => {}); } setToken(""); }

  /* --------------------------- Commandes (write-through) -------------------------- */
  async function syncOrders(orders) {
    if (!API.enabled || !Array.isArray(orders)) return;
    for (const o of orders) {
      const body = {
        items: (o.items || []).map((i) => ({
          productId: i.productId, name: i.title, price: i.unit, qty: i.qty,
          variant: i.variant && Object.keys(i.variant).length ? JSON.stringify(i.variant) : "",
        })),
        customerName: o.delivery ? o.delivery.name : o.buyerName,
        phone: o.delivery ? o.delivery.phone : "",
        address: o.delivery ? o.delivery.address : "",
        city: o.delivery ? o.delivery.commune : "",
        deliveryFee: o.deliveryFee || 0,
        discount: o.discount || 0,
        note: "Réf. " + (o.number || o.id) + (o.storeName ? " — " + o.storeName : ""),
        payment: "cod",
      };
      try { await post("/orders", body); } catch (e) {}
    }
  }

  /* --------------------------- Consultations (lecture) ---------------------------- */
  async function products(params) {
    if (!API.enabled) return [];
    const qs = new URLSearchParams(params || {}).toString();
    const j = await get("/products" + (qs ? "?" + qs : ""));
    return (j && j.items) || [];
  }
  async function myOrders() {
    if (!API.enabled || !token()) return [];
    const j = await get("/orders");
    return (j && j.items) || [];
  }

  API.init = init;
  API.syncRegister = syncRegister;
  API.syncLogin = syncLogin;
  API.logout = logout;
  API.syncOrders = syncOrders;
  API.products = products;      // fonction (le nombre est dans API.productCount)
  API.myOrders = myOrders;
  API.token = token;
  API.adminUrl = adminUrl;
  window.MP.Api = API;
})();

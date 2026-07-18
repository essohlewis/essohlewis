/* =========================================================================
   ui.js — Utilitaires d'interface : formatage, échappement XSS, toasts,
   modales, placeholders SVG, gestion des badges, upload d'images base64.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;

  /* ---------- Formatage ---------- */

  /** Formate un prix en FCFA avec séparateur d'espace : 1500 -> "1 500 FCFA". */
  function fcfa(n) {
    const v = Math.round(Number(n) || 0);
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
  }

  /** Date relative en français (il y a X minutes/heures/jours). */
  function timeAgo(ts) {
    const d = Date.now() - ts;
    const s = Math.floor(d / 1000);
    if (s < 60) return "à l'instant";
    const m = Math.floor(s / 60);
    if (m < 60) return "il y a " + m + " min";
    const h = Math.floor(m / 60);
    if (h < 24) return "il y a " + h + " h";
    const j = Math.floor(h / 24);
    if (j < 7) return "il y a " + j + " j";
    return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function dateFR(ts) {
    return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }

  /* ---------- Sécurité : échappement anti-XSS ---------- */

  /** Échappe le HTML pour tout contenu saisi par l'utilisateur. */
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Nettoie une URL d'image : n'autorise que data: et http(s). Sinon placeholder. */
  function safeImg(src, seed) {
    if (typeof src === "string" && /^(data:image\/|https?:\/\/)/i.test(src)) return src;
    return placeholder(seed || "?");
  }

  /* ---------- Placeholders SVG (aucune ressource externe) ---------- */

  const PALETTE = ["#f97316", "#0f9d58", "#2563eb", "#7c3aed", "#e11d48", "#0891b2", "#d97706"];

  /** Génère une image placeholder colorée en data URI SVG (avec initiale). */
  function placeholder(text) {
    const t = String(text || "?").trim();
    const initial = t ? t[0].toUpperCase() : "?";
    let hash = 0;
    for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;
    const c1 = PALETTE[hash % PALETTE.length];
    const c2 = PALETTE[(hash >> 3) % PALETTE.length];
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
      `<rect width='400' height='400' fill='url(#g)'/>` +
      `<text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Segoe UI,Arial' ` +
      `font-size='170' font-weight='700' fill='rgba(255,255,255,.85)'>${initial}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  /* ---------- Étoiles ---------- */

  /** Rendu HTML d'une note en étoiles (0–5). */
  function starsHTML(rating) {
    const r = Math.round(rating || 0);
    let s = "";
    for (let i = 1; i <= 5; i++) s += i <= r ? "★" : "☆";
    return `<span class="stars" title="${(rating || 0).toFixed(1)}/5">${s}</span>`;
  }

  /* ---------- Toasts ---------- */

  const toastWrap = () => document.getElementById("toastWrap");

  const ICONS = {
    success: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/></svg>",
    error: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z'/></svg>",
    info: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z'/></svg>",
  };

  /** Affiche un toast (type: success | error | info). */
  function toast(msg, type) {
    type = type || "info";
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = `<span class="t-ico">${ICONS[type] || ICONS.info}</span><span>${esc(msg)}</span>`;
    toastWrap().appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ---------- Modales ---------- */

  const modalRoot = () => document.getElementById("modalRoot");

  /**
   * Ouvre une modale.
   * @param {object} opts { title, body(HTML), footer(HTML), onMount(fn) }
   * @returns fonction de fermeture
   */
  function modal(opts) {
    opts = opts || {};
    const root = modalRoot();
    root.innerHTML =
      `<div class="modal-overlay" data-close></div>` +
      `<div class="modal" role="dialog" aria-modal="true">` +
      `<div class="modal-head"><h3>${esc(opts.title || "")}</h3>` +
      `<button class="modal-close" data-close aria-label="Fermer">` +
      `<svg viewBox='0 0 24 24' width='20' height='20'><path fill='currentColor' d='M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3 10.6 10.6 16.9 4.3z'/></svg>` +
      `</button></div>` +
      `<div class="modal-body">${opts.body || ""}</div>` +
      (opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : "") +
      `</div>`;
    root.classList.add("open");
    document.body.style.overflow = "hidden";

    function close() {
      root.classList.remove("open");
      root.innerHTML = "";
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));

    if (typeof opts.onMount === "function") opts.onMount(root.querySelector(".modal"), close);
    return close;
  }

  /** Fenêtre de confirmation simple, renvoie une Promise<boolean>. */
  function confirm(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const close = modal({
        title: opts.title || "Confirmation",
        body: `<p style="margin:0;color:var(--text-2)">${esc(message)}</p>`,
        footer:
          `<button class="btn btn-ghost" data-no>Annuler</button>` +
          `<button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(opts.confirmLabel || "Confirmer")}</button>`,
        onMount(m) {
          m.querySelector("[data-no]").addEventListener("click", () => { close(); resolve(false); });
          m.querySelector("[data-yes]").addEventListener("click", () => { close(); resolve(true); });
        },
      });
    });
  }

  /* ---------- Upload d'images -> base64 (redimensionné) ---------- */

  /**
   * Lit un fichier image, le redimensionne (max 900px) et renvoie une dataURL JPEG.
   * Réduit fortement l'empreinte localStorage.
   */
  function fileToDataURL(file, maxSize) {
    maxSize = maxSize || 900;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("Fichier non image"));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Mise à jour des badges (panier, notifs, favoris) ---------- */

  function setBadge(ids, count) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (count > 0) {
        el.textContent = count > 99 ? "99+" : count;
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });
  }

  /** Rafraîchit tous les badges d'après l'état courant. */
  function refreshBadges() {
    const user = window.MP.Auth ? window.MP.Auth.current() : null;
    const cartCount = window.MP.Cart ? window.MP.Cart.count() : 0;
    const notifCount = window.MP.Notifications ? window.MP.Notifications.unreadCount() : 0;
    let favCount = 0;
    if (user) {
      const favs = DB.get(DB.KEYS.favorites, {})[user.id] || [];
      favCount = favs.length;
    }
    setBadge(["cartBadge", "cartBadgeMobile"], cartCount);
    setBadge(["notifBadge", "notifBadgeMobile"], notifCount);
    setBadge(["favBadge"], favCount);
  }

  /* ---------- Communes d'Abidjan / CI (données de référence) ---------- */
  const COMMUNES = [
    "Cocody", "Yopougon", "Plateau", "Marcory", "Treichville", "Adjamé",
    "Abobo", "Koumassi", "Port-Bouët", "Attécoubé", "Bingerville", "Songon",
    "Bouaké", "Yamoussoukro", "San-Pédro", "Daloa",
  ];

  const CATEGORIES = [
    { id: "mode", label: "Mode & Vêtements", icon: "👗" },
    { id: "electronique", label: "Électronique", icon: "📱" },
    { id: "maison", label: "Maison & Déco", icon: "🛋️" },
    { id: "beaute", label: "Beauté & Soins", icon: "💄" },
    { id: "alimentation", label: "Alimentation", icon: "🥘" },
    { id: "accessoires", label: "Accessoires", icon: "👜" },
    { id: "enfants", label: "Enfants & Bébé", icon: "🧸" },
    { id: "sport", label: "Sport & Loisirs", icon: "⚽" },
  ];

  function categoryLabel(id) {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? c.label : id;
  }

  window.MP.UI = {
    fcfa, timeAgo, dateFR, esc, safeImg, placeholder, starsHTML,
    toast, modal, confirm, fileToDataURL,
    setBadge, refreshBadges, COMMUNES, CATEGORIES, categoryLabel,
  };
})();

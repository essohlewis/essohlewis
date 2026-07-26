/* =============================================================================
   Amoura — script global (thème, toasts, lightbox, notifications, temps réel)
   ========================================================================== */
(function (global) {
  "use strict";

  /* ---- Thème clair/sombre ---- */
  const Theme = {
    apply(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      try { localStorage.setItem("amoura-theme", theme); } catch (_) {}
    },
    toggle() {
      const current = document.documentElement.getAttribute("data-theme")
        || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      this.apply(current === "dark" ? "light" : "dark");
    },
    init() {
      let saved = null;
      try { saved = localStorage.getItem("amoura-theme"); } catch (_) {}
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    },
  };
  Theme.init();

  /* ---- Toasts ---- */
  function toast(message, variant) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "toast" + (variant ? " " + variant : "");
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3200);
  }

  /* ---- Lightbox pour images ---- */
  function initLightbox() {
    let box = document.querySelector(".lightbox");
    if (!box) {
      box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = '<span class="close">&times;</span><img alt="">';
      document.body.appendChild(box);
      box.addEventListener("click", () => box.classList.remove("open"));
    }
    document.addEventListener("click", (e) => {
      const img = e.target.closest("[data-lightbox]");
      if (img) {
        box.querySelector("img").src = img.getAttribute("data-full") || img.src;
        box.classList.add("open");
      }
    });
  }

  /* ---- Notifications (badge + poll de secours) ---- */
  async function refreshNotifications() {
    try {
      const res = await Api.get("/api/notifications");
      const badge = document.querySelector('[data-notif-badge]');
      if (badge) {
        badge.textContent = res.unread > 99 ? "99+" : res.unread;
        badge.style.display = res.unread > 0 ? "grid" : "none";
      }
    } catch (_) {}
  }

  /* ---- Connexion temps réel (WebSocket) ---- */
  const Realtime = {
    ws: null, ready: false, handlers: {}, reconnectDelay: 1000,
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    emit(type, payload) {
      if (this.ws && this.ready) this.ws.send(JSON.stringify(Object.assign({ type }, payload)));
    },
    async connect() {
      try {
        const t = await Api.get("/api/ws-ticket");
        this.ws = new WebSocket(t.ws_url + "?ticket=" + encodeURIComponent(t.ticket));
        this.ws.onopen = () => { this.reconnectDelay = 1000; };
        this.ws.onmessage = (ev) => {
          let data; try { data = JSON.parse(ev.data); } catch (_) { return; }
          if (data.type === "ready") { this.ready = true; }
          (this.handlers[data.type] || []).forEach((fn) => fn(data));
          this._defaultHandle(data);
        };
        this.ws.onclose = () => {
          this.ready = false;
          setTimeout(() => this.connect(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
        };
      } catch (_) {
        setTimeout(() => this.connect(), 5000);
      }
    },
    _defaultHandle(data) {
      if (data.type === "notification") {
        refreshNotifications();
        const p = data.payload || {};
        if (p.type === "match") toast("✨ Nouveau match !", "match");
        else if (p.type === "message") toast("💬 Nouveau message");
        else if (p.type === "like") toast("❤️ Quelqu'un vous a liké");
      }
    },
  };

  /* ---- Initialisation ---- */
  document.addEventListener("DOMContentLoaded", () => {
    initLightbox();

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => Theme.toggle())
    );

    // Déconnexion via formulaire (garde le CSRF).
    document.querySelectorAll("[data-logout]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const f = document.createElement("form");
        f.method = "POST"; f.action = "/logout";
        f.innerHTML = '<input type="hidden" name="_csrf" value="' + Api.csrfToken() + '">';
        document.body.appendChild(f); f.submit();
      })
    );

    if (document.body.dataset.auth === "1") {
      Realtime.connect();
      refreshNotifications();
      setInterval(refreshNotifications, 60000);
    }
  });

  global.Amoura = { Theme, toast, Realtime, refreshNotifications };
})(window);

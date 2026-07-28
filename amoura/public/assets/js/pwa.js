/* =============================================================================
   Amoura — Expérience d'installation PWA (A2HS).
   - Capte l'événement `beforeinstallprompt` (Chrome/Edge/Android) et propose une
     bannière d'installation maison, plutôt que de laisser filer l'invite native.
   - Gère `appinstalled`, mémorise le rejet (localStorage) pour ne pas harceler.
   - Repli iOS/Safari : ces navigateurs n'exposent pas `beforeinstallprompt` ;
     on affiche une aide « Ajouter à l'écran d'accueil » via le menu Partager.
   Ne s'affiche jamais si l'app est déjà lancée en mode installé (standalone).
   ========================================================================== */
(function () {
  "use strict";

  var DISMISS_KEY = "amoura_pwa_dismissed_at";
  var DISMISS_DAYS = 14; // délai avant de re-proposer après un rejet
  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function recentlyDismissed() {
    var ts = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    if (!ts) return false;
    return (Date.now() - ts) < DISMISS_DAYS * 864e5;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !/crios|fxios/i.test(window.navigator.userAgent); // Safari iOS uniquement
  }

  function injectStyles() {
    if (document.getElementById("pwa-banner-style")) return;
    var css = "" +
      ".pwa-banner{position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);z-index:2000;width:min(480px,calc(100% - 24px));" +
      "background:#fff;color:#1e2230;border-radius:16px;padding:14px 16px;" +
      "box-shadow:0 12px 40px rgba(30,34,48,.22);display:flex;align-items:center;gap:12px;" +
      "animation:pwaUp .28s ease-out}" +
      "@keyframes pwaUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}" +
      ".pwa-banner img{width:44px;height:44px;border-radius:12px;flex:0 0 auto}" +
      ".pwa-banner .pwa-txt{flex:1 1 auto;min-width:0}" +
      ".pwa-banner .pwa-txt b{display:block;font-size:.95rem}" +
      ".pwa-banner .pwa-txt span{font-size:.8rem;color:#5b6270}" +
      ".pwa-banner .pwa-actions{display:flex;gap:6px;flex:0 0 auto}" +
      ".pwa-banner button{border:none;border-radius:10px;padding:8px 12px;font-size:.85rem;" +
      "font-weight:600;cursor:pointer}" +
      ".pwa-banner .pwa-install{background:linear-gradient(135deg,#8b5cf6,#ff5a7e);color:#fff}" +
      ".pwa-banner .pwa-close{background:transparent;color:#5b6270;font-size:1.2rem;padding:4px 8px}" +
      "@media(max-width:600px){.pwa-banner .pwa-txt span{display:none}}" +
      "@media(prefers-color-scheme:dark){.pwa-banner{background:#20222c;color:#eef0f6}" +
      ".pwa-banner .pwa-txt span,.pwa-banner .pwa-close{color:#9aa0ad}}";
    var el = document.createElement("style");
    el.id = "pwa-banner-style";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function removeBanner() {
    var b = document.getElementById("pwa-banner");
    if (b) b.remove();
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    removeBanner();
  }

  function showBanner(opts) {
    if (document.getElementById("pwa-banner")) return;
    injectStyles();
    var banner = document.createElement("div");
    banner.className = "pwa-banner";
    banner.id = "pwa-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Installer l'application");

    var icon = document.createElement("img");
    icon.src = "/assets/img/icon-192.png";
    icon.alt = "";

    var txt = document.createElement("div");
    txt.className = "pwa-txt";
    var title = document.createElement("b");
    title.textContent = opts.title;
    var sub = document.createElement("span");
    sub.textContent = opts.subtitle;
    txt.appendChild(title);
    txt.appendChild(sub);

    var actions = document.createElement("div");
    actions.className = "pwa-actions";
    if (opts.onInstall) {
      var install = document.createElement("button");
      install.className = "pwa-install";
      install.textContent = "Installer";
      install.addEventListener("click", opts.onInstall);
      actions.appendChild(install);
    }
    var close = document.createElement("button");
    close.className = "pwa-close";
    close.setAttribute("aria-label", "Fermer");
    close.innerHTML = "&times;";
    close.addEventListener("click", dismiss);
    actions.appendChild(close);

    banner.appendChild(icon);
    banner.appendChild(txt);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  // Chrome/Edge/Android : invite native différée + bannière maison.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (isStandalone() || recentlyDismissed()) return;
    showBanner({
      title: "Installer Amoura",
      subtitle: "Accès rapide, plein écran et notifications.",
      onInstall: function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") removeBanner();
          else dismiss();
          deferredPrompt = null;
        });
      },
    });
  });

  // Installation confirmée : nettoyage + on ne re-propose plus.
  window.addEventListener("appinstalled", function () {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    removeBanner();
    deferredPrompt = null;
  });

  // iOS/Safari : pas d'invite programmatique → aide « Partager → Sur l'écran d'accueil ».
  window.addEventListener("load", function () {
    if (!isIos() || isStandalone() || recentlyDismissed()) return;
    showBanner({
      title: "Installer Amoura",
      subtitle: "Appuyez sur Partager ↑ puis « Sur l'écran d'accueil ».",
      onInstall: null,
    });
  });
})();

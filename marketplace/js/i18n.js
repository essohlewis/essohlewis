/* =========================================================================
   i18n.js — Multi-langue (français / anglais). Fondation : traduit le chrome
   persistant (navigation, recherche) et les libellés courants via MP.I18n.t().
   La langue est mémorisée. Le contenu saisi par les utilisateurs reste tel quel.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;

  const DICT = {
    fr: {
      "nav.home": "Accueil", "nav.search": "Recherche", "nav.cart": "Panier",
      "nav.alerts": "Alertes", "nav.profile": "Profil",
      "search.placeholder": "Rechercher un article, une boutique…",
      "menu.login": "Se connecter", "menu.register": "Créer un compte",
      "menu.becomeSeller": "Devenir vendeur", "menu.profile": "Mon profil",
      "menu.orders": "Mes commandes", "menu.favorites": "Mes favoris",
      "menu.messages": "Mes messages", "menu.sellerSpace": "Espace vendeur",
      "menu.openShop": "Ouvrir ma boutique", "menu.admin": "Administration",
      "menu.logout": "Se déconnecter", "menu.deals": "Bons plans", "menu.help": "Centre d'aide",
      "common.addCart": "Ajouter au panier", "common.buy": "Commander",
    },
    en: {
      "nav.home": "Home", "nav.search": "Search", "nav.cart": "Cart",
      "nav.alerts": "Alerts", "nav.profile": "Profile",
      "search.placeholder": "Search an item, a shop…",
      "menu.login": "Sign in", "menu.register": "Create account",
      "menu.becomeSeller": "Become a seller", "menu.profile": "My profile",
      "menu.orders": "My orders", "menu.favorites": "My favorites",
      "menu.messages": "My messages", "menu.sellerSpace": "Seller space",
      "menu.openShop": "Open my shop", "menu.admin": "Administration",
      "menu.logout": "Sign out", "menu.deals": "Deals", "menu.help": "Help center",
      "common.addCart": "Add to cart", "common.buy": "Order",
    },
  };

  let lang = "fr";

  function get() { return lang; }
  function t(key) { return (DICT[lang] && DICT[lang][key]) || (DICT.fr[key] || key); }

  function set(l) {
    lang = DICT[l] ? l : "fr";
    DB.set("lang", lang);
    document.documentElement.setAttribute("lang", lang);
    applyStatic();
  }

  /** Applique les traductions aux éléments statiques (nav basse, recherche). */
  function applyStatic() {
    const map = {
      '.bn-item[data-route="#/"] span': "nav.home",
      '.bn-item[data-route="#/search"] span': "nav.search",
      '.bn-item[data-route="#/cart"] span': "nav.cart",
      '.bn-item[data-route="#/notifications"] span': "nav.alerts",
      '.bn-item[data-route="#/profile"] span': "nav.profile",
    };
    Object.keys(map).forEach((sel) => { const el = document.querySelector(sel); if (el) el.textContent = t(map[sel]); });
    const inp = document.getElementById("headerSearchInput");
    if (inp) inp.setAttribute("placeholder", t("search.placeholder"));
  }

  function init() {
    lang = DB.get("lang", null) || "fr";
    document.documentElement.setAttribute("lang", lang);
    applyStatic();
  }

  window.MP.I18n = { t, get, set, init, LANGS: [["fr", "Français"], ["en", "English"]] };
})();

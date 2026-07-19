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
      // Accueil
      "home.heroTitle": "Le marché en ligne de Côte d'Ivoire",
      "home.heroSub": "Des centaines d'articles de vendeurs près de chez vous. Payez en espèces à la livraison.",
      "home.pillDelivery": "🚚 Livraison à domicile", "home.pillCod": "💵 Paiement à la livraison",
      "home.tabForYou": "🏠 Pour vous", "home.tabFollowed": "➕ Suivis",
      "home.deals": "🔥 Bons plans", "home.stores": "🏪 Boutiques", "home.activity": "📊 Mon activité",
      "home.recentlyViewed": "Vus récemment", "home.recommended": "✨ Recommandé pour vous",
      "home.discover": "À découvrir", "home.results": "Résultats", "home.newFromFollowed": "Nouveautés de vos boutiques suivies",
      // Panier
      "cart.title": "Mon panier", "cart.empty": "Votre panier est vide",
      "cart.emptySub": "Parcourez les boutiques et ajoutez des articles.",
      "cart.summary": "Récapitulatif", "cart.subtotal": "Sous-total", "cart.delivery": "Livraison",
      "cart.toAgree": "À convenir", "cart.total": "Total", "cart.checkout": "Commander",
      "cart.clear": "Vider le panier", "cart.savedForLater": "Enregistré pour plus tard",
      "cart.saveForLater": "🔖 Garder pour plus tard", "cart.moveToCart": "↩︎ Au panier",
      "cart.discover": "Découvrir les articles",
      // Commandes
      "orders.title": "Mes commandes", "orders.empty": "Aucune commande",
      "orders.emptySub": "Vous n'avez pas encore passé de commande.",
      // Recherche
      "search.explore": "Explorer", "search.results": "Résultats",
      "search.exploreSub": "Parcourez tous les articles disponibles.",
      // Profil
      "profile.security": "Sécurité du compte", "profile.prefs": "Préférences & accessibilité",
      "profile.sellerSpace": "Espace vendeur", "profile.save": "Enregistrer",
      // Commun
      "common.continue": "Continuer mes achats", "common.viewShop": "Voir la boutique",
      "common.seeAll": "Tout voir", "common.back": "Retour", "common.cancel": "Annuler",
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
      // Home
      "home.heroTitle": "Côte d'Ivoire's online marketplace",
      "home.heroSub": "Hundreds of items from sellers near you. Pay cash on delivery.",
      "home.pillDelivery": "🚚 Home delivery", "home.pillCod": "💵 Cash on delivery",
      "home.tabForYou": "🏠 For you", "home.tabFollowed": "➕ Followed",
      "home.deals": "🔥 Deals", "home.stores": "🏪 Shops", "home.activity": "📊 My activity",
      "home.recentlyViewed": "Recently viewed", "home.recommended": "✨ Recommended for you",
      "home.discover": "Discover", "home.results": "Results", "home.newFromFollowed": "New from shops you follow",
      // Cart
      "cart.title": "My cart", "cart.empty": "Your cart is empty",
      "cart.emptySub": "Browse the shops and add some items.",
      "cart.summary": "Summary", "cart.subtotal": "Subtotal", "cart.delivery": "Delivery",
      "cart.toAgree": "To be agreed", "cart.total": "Total", "cart.checkout": "Checkout",
      "cart.clear": "Empty cart", "cart.savedForLater": "Saved for later",
      "cart.saveForLater": "🔖 Save for later", "cart.moveToCart": "↩︎ Move to cart",
      "cart.discover": "Discover items",
      // Orders
      "orders.title": "My orders", "orders.empty": "No orders yet",
      "orders.emptySub": "You haven't placed any order yet.",
      // Search
      "search.explore": "Explore", "search.results": "Results",
      "search.exploreSub": "Browse all available items.",
      // Profile
      "profile.security": "Account security", "profile.prefs": "Preferences & accessibility",
      "profile.sellerSpace": "Seller space", "profile.save": "Save",
      // Common
      "common.continue": "Continue shopping", "common.viewShop": "View shop",
      "common.seeAll": "See all", "common.back": "Back", "common.cancel": "Cancel",
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

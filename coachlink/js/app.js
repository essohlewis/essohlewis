/* ==========================================================================
   app.js — Point d'entrée & routeur SPA (navigation par #/route).
   - Amorce le stockage, applique le thème, rend l'en-tête.
   - Associe chaque route à une fonction de page (CL.pages.*).
   - Gère les shells : pages publiques (+ pied) vs tableaux de bord (+ sidebar).
   - Protège les routes nécessitant un rôle.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};

  const app = document.getElementById("app");

  /* --------------------- Définition des routes ---------------------- */
  // Chaque route : { motif:RegExp, page:fn, shell:"public"|"dash", role?:string }
  const routes = [
    { motif: /^\/?$/, page: "home", shell: "public" },
    { motif: /^\/recherche$/, page: "recherche", shell: "public" },
    { motif: /^\/coachmatch$/, page: "coachmatch", shell: "public" },
    { motif: /^\/comment-ca-marche$/, page: "commentCaMarche", shell: "public" },
    { motif: /^\/coach\/([\w-]+)$/, page: "profilCoach", shell: "public", param: "coachId" },
    { motif: /^\/connexion$/, page: "connexion", shell: "nu" },
    { motif: /^\/inscription$/, page: "inscription", shell: "nu" },
    { motif: /^\/reinitialiser$/, page: "reinitialiser", shell: "nu" },

    { motif: /^\/client$/, page: "clientAccueil", shell: "dash", role: "client" },
    { motif: /^\/client\/reservations$/, page: "clientReservations", shell: "dash", role: "client" },
    { motif: /^\/client\/favoris$/, page: "clientFavoris", shell: "dash", role: "client" },
    { motif: /^\/client\/avis$/, page: "clientAvis", shell: "dash", role: "client" },

    { motif: /^\/espace-coach$/, page: "coachAccueil", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/reservations$/, page: "coachReservations", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/profil$/, page: "coachProfil", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/mur$/, page: "coachMur", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/galerie$/, page: "coachGalerie", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/disponibilites$/, page: "coachDispo", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/diplomes$/, page: "coachDiplomes", shell: "dash", role: "coach" },
    { motif: /^\/espace-coach\/avis$/, page: "coachAvis", shell: "dash", role: "coach" },

    { motif: /^\/admin$/, page: "adminAccueil", shell: "dash", role: "admin" },
    { motif: /^\/admin\/diplomes$/, page: "adminDiplomes", shell: "dash", role: "admin" },
    { motif: /^\/admin\/utilisateurs$/, page: "adminUtilisateurs", shell: "dash", role: "admin" },
    { motif: /^\/admin\/litiges$/, page: "adminLitiges", shell: "dash", role: "admin" },

    { motif: /^\/messages$/, page: "messages", shell: "dash", role: "any" },
    { motif: /^\/notifications$/, page: "notifications", shell: "dash", role: "any" },
    { motif: /^\/parametres$/, page: "parametres", shell: "dash", role: "any" },
  ];

  /* ------------------------ Analyse de l'URL ------------------------ */
  function analyser() {
    const brut = location.hash.replace(/^#/, "") || "/";
    const [chemin, requete] = brut.split("?");
    const params = {};
    if (requete) {
      requete.split("&").forEach((p) => {
        const [k, v] = p.split("=");
        params[decodeURIComponent(k)] = decodeURIComponent(v || "");
      });
    }
    return { chemin, params };
  }

  /* ---------------------------- Sidebars ---------------------------- */
  function sidebarPour(role, routeActive) {
    const u = CL.auth.courant();
    const nbMsg = u ? CL.messageService.nbNonLus(u.id) : 0;
    const nbNotif = u ? CL.notifications.nbNonLues(u.id) : 0;
    if (role === "client") {
      return CL.layout.sidebar("Espace client", [
        { href: "#/client", icone: "dashboard", label: "Tableau de bord" },
        { href: "#/client/reservations", icone: "calendrier", label: "Mes réservations" },
        { href: "#/client/favoris", icone: "coeur", label: "Mes favoris" },
        { href: "#/client/avis", icone: "etoile", label: "Mes avis" },
        { href: "#/messages", icone: "message", label: "Messagerie", compteur: nbMsg || null },
        { href: "#/notifications", icone: "cloche", label: "Notifications", compteur: nbNotif || null },
        { href: "#/recherche", icone: "recherche", label: "Trouver un coach" },
        { href: "#/parametres", icone: "parametres", label: "Paramètres" },
      ], routeActive);
    }
    if (role === "coach") {
      const c = coachDeLutilisateur();
      const nbDemandes = c ? CL.bookingService.parCoach(c.id).filter((b) => b.statut === "en_attente").length : 0;
      return CL.layout.sidebar("Espace coach", [
        { href: "#/espace-coach", icone: "dashboard", label: "Tableau de bord" },
        { href: "#/espace-coach/reservations", icone: "calendrier", label: "Demandes", compteur: nbDemandes || null },
        { href: "#/espace-coach/profil", icone: "utilisateur", label: "Mon profil" },
        { href: "#/espace-coach/mur", icone: "document", label: "Mon mur" },
        { href: "#/espace-coach/galerie", icone: "galerie", label: "Ma galerie" },
        { href: "#/espace-coach/disponibilites", icone: "horloge", label: "Disponibilités" },
        { href: "#/espace-coach/diplomes", icone: "diplome", label: "Diplômes" },
        { href: "#/espace-coach/avis", icone: "etoile", label: "Avis reçus" },
        { href: "#/messages", icone: "message", label: "Messagerie", compteur: nbMsg || null },
        { href: "#/notifications", icone: "cloche", label: "Notifications", compteur: nbNotif || null },
        { href: "#/parametres", icone: "parametres", label: "Paramètres" },
      ], routeActive);
    }
    if (role === "admin") {
      const nbDiplomes = CL.coachService.diplomesEnAttente().length;
      return CL.layout.sidebar("Administration", [
        { href: "#/admin", icone: "graphique", label: "Statistiques" },
        { href: "#/admin/diplomes", icone: "diplome", label: "Diplômes", compteur: nbDiplomes || null },
        { href: "#/admin/utilisateurs", icone: "utilisateurs", label: "Utilisateurs" },
        { href: "#/admin/litiges", icone: "bouclier", label: "Litiges" },
        { href: "#/messages", icone: "message", label: "Messagerie", compteur: nbMsg || null },
        { href: "#/notifications", icone: "cloche", label: "Notifications", compteur: nbNotif || null },
      ], routeActive);
    }
    return null;
  }

  /** Sidebar selon le rôle de l'utilisateur courant (routes "any"). */
  function sidebarUtilisateur(routeActive) {
    const u = CL.auth.courant();
    return u ? sidebarPour(u.role, routeActive) : null;
  }

  function coachDeLutilisateur() {
    const u = CL.auth.courant();
    if (!u) return null;
    const cid = u.coachId || (CL.auth.coachIdCourant && CL.auth.coachIdCourant());
    if (cid) return CL.coachService.obtenir(cid);
    return CL.coachService.lister().find((c) => String(c.proprietaire) === String(u.id)) || null;
  }
  CL.coachCourant = coachDeLutilisateur;

  /* ------------------------------ Rendu ----------------------------- */
  function rendre() {
    const { chemin, params } = analyser();
    CL.layout.fermerPanneaux && CL.layout.fermerPanneaux();
    CL.layout.fermerMenuPublic && CL.layout.fermerMenuPublic();

    let trouve = null, args = params;
    for (const r of routes) {
      const m = chemin.match(r.motif);
      if (m) {
        trouve = r;
        if (r.param && m[1]) args = Object.assign({}, params, { [r.param]: m[1] });
        break;
      }
    }

    // 404
    if (!trouve) { rendre404(); return; }

    // Restriction du coach : espace dédié, sans accueil public, recherche,
    // CoachMatch ni consultation d'autres coachs.
    const uc = CL.auth.courant();
    if (uc && uc.role === "coach") {
      const pagesInterdites = ["home", "recherche", "coachmatch"];
      if (pagesInterdites.includes(trouve.page)) { location.hash = "#/espace-coach"; return; }
      if (trouve.page === "profilCoach") {
        const monCoach = CL.coachCourant();
        if (!monCoach || args.coachId !== monCoach.id) {
          CL.toast.info("Espace coach", "Vous ne pouvez consulter que votre propre profil.");
          location.hash = "#/espace-coach";
          return;
        }
      }
    }

    // Garde de rôle
    if (trouve.role) {
      const u = CL.auth.courant();
      if (!u) { CL.toast.info("Connexion requise", "Veuillez vous connecter."); location.hash = "#/connexion"; return; }
      if (trouve.role !== "any" && u.role !== trouve.role) {
        CL.toast.erreur("Accès refusé", "Cette page ne correspond pas à votre rôle.");
        location.hash = "#/";
        return;
      }
    }

    const renduPage = CL.pages[trouve.page];
    if (typeof renduPage !== "function") { rendre404(); return; }

    let contenu;
    try {
      contenu = renduPage(args) || document.createElement("div");
    } catch (e) {
      console.error("Erreur de rendu de page", trouve.page, e);
      contenu = CL.ui.vide("fermer", "Une erreur est survenue", e.message);
    }

    CL.dom.vider(app);
    contenu.classList.add("page-anim"); // transition douce à chaque page

    if (trouve.shell === "dash") {
      const role = trouve.role === "any" ? (CL.auth.courant() || {}).role : trouve.role;
      const sb = trouve.role === "any" ? sidebarUtilisateur(chemin.startsWith("/messages") ? "#/messages" : "#" + chemin) : sidebarPour(role, "#" + chemin);
      const overlay = CL.dom.el("div", { class: "sidebar-overlay" });
      overlay.addEventListener("click", CL.layout.basculerSidebarMobile);
      const shell = CL.dom.el("div", { class: "app-shell" }, [
        sb, overlay,
        CL.dom.el("main", { class: "contenu" }, [contenu]),
      ]);
      app.appendChild(shell);
    } else if (trouve.shell === "nu") {
      app.appendChild(contenu);
    } else {
      app.appendChild(CL.dom.el("main", {}, [contenu]));
      app.appendChild(CL.layout.pied());
    }

    CL.layout.rendreEntete();
    window.scrollTo(0, 0);
    observerReveal();
  }

  /* Apparition progressive des éléments .reveal au défilement. */
  function observerReveal() {
    const cibles = CL.dom.qsa(".reveal:not(.visible)", app);
    if (!cibles.length) return;
    if (!("IntersectionObserver" in window)) {
      cibles.forEach((c) => c.classList.add("visible"));
      return;
    }
    const obs = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    cibles.forEach((c) => obs.observe(c));
  }

  function rendre404() {
    CL.dom.vider(app);
    app.appendChild(CL.dom.el("main", { class: "conteneur", style: "padding:80px 16px;text-align:center" }, [
      CL.dom.el("div", { style: "font-size:5rem;font-weight:800;color:var(--bleu-confiance)", text: "404" }),
      CL.dom.el("h2", { text: "Page introuvable" }),
      CL.dom.el("p", { class: "mb-4", text: "La page que vous cherchez n'existe pas ou a été déplacée." }),
      CL.dom.el("a", { class: "btn btn-primaire", href: "#/", text: "Retour à l'accueil" }),
    ]));
    app.appendChild(CL.layout.pied());
    CL.layout.rendreEntete();
  }

  /* ------------------------- Initialisation ------------------------- */
  function init() {
    // Thème persistant
    const prefs = CL.storage.lire(CL.storage.CLES.prefs, {});
    if (prefs.theme) document.documentElement.setAttribute("data-theme", prefs.theme);

    CL.i18n.init();
    CL.storage.amorcer();
    CL.socialService.resetOpenGraph();

    window.addEventListener("hashchange", rendre);
    window.addEventListener("cl:notif", () => CL.layout.rendreEntete());
    window.addEventListener("cl:favoris", () => {});

    installerRetourHaut();
    CL.compareBar && CL.compareBar.installer();

    // Mode API : on hydrate le store local depuis le backend avant le 1er rendu.
    if (CL.API && CL.API.actif) {
      demarrerAvecApi();
    } else {
      rendre();
    }

    // Enregistrement du service worker (PWA) — ignoré en file://.
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  /** Amorçage en mode backend : charge le catalogue (+ données utilisateur). */
  async function demarrerAvecApi() {
    try {
      await CL.hydrate.catalogue();
      if (CL.auth.estConnecte()) {
        await CL.hydrate.donneesUtilisateur();
        CL.realtime && CL.realtime.demarrer(); // « temps réel » (polling)
      }
    } catch (e) {
      console.warn("API injoignable — bascule hors-ligne.", e);
      CL.toast && CL.toast.erreur("Backend injoignable", "Affichage des données de démonstration.");
    }
    rendre();
  }

  /* Bouton flottant « retour en haut » (apparaît après défilement). */
  function installerRetourHaut() {
    const btn = CL.dom.el("button", {
      class: "retour-haut", "aria-label": "Retour en haut",
      html: CL.icon("fleche_gauche", 22),
    });
    // La flèche « gauche » pivotée de 90° pointe vers le haut.
    btn.querySelector("svg").style.transform = "rotate(90deg)";
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    document.body.appendChild(btn);
    let tick = false;
    window.addEventListener("scroll", () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        btn.classList.toggle("visible", window.scrollY > 500);
        tick = false;
      });
    }, { passive: true });
  }

  CL.router = { rendre, aller: (h) => { location.hash = h; } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

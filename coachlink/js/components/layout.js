/* ==========================================================================
   components/layout.js — En-tête (nav, thème, cloche, menu utilisateur),
   pied de page, sidebar de tableau de bord, menu burger mobile.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el, esc } = CL.dom;
  const { auth, ui } = CL;

  /* ------------------------------ Thème ------------------------------ */
  function themeCourant() {
    return document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function basculerTheme() {
    const nouveau = themeCourant() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nouveau);
    const prefs = CL.storage.lire(CL.storage.CLES.prefs, {});
    prefs.theme = nouveau;
    CL.storage.ecrire(CL.storage.CLES.prefs, prefs);
    rendreEntete();
  }

  /* --------------------------- Cloche notif -------------------------- */
  function panneauNotifications(ancre) {
    const u = auth.courant();
    if (!u) return;
    fermerPanneaux();
    const liste = CL.notifications.parUtilisateur(u.id).slice(0, 12);
    const panneau = el("div", { class: "notif-panneau", id: "notif-panneau" }, [
      el("div", { class: "rangee entre", style: "padding:12px 16px;border-bottom:1px solid var(--bordure)" }, [
        el("strong", { text: "Notifications" }),
        el("button", { class: "btn-lien texte-xs", text: "Tout marquer lu", onclick: () => { CL.notifications.marquerToutesLues(u.id); fermerPanneaux(); rendreEntete(); } }),
      ]),
      liste.length
        ? el("div", {}, liste.map((n) => {
            const item = el("div", { class: "notif-item" + (n.lu ? "" : " non-lu") }, [
              el("div", { class: "notif-item__point", style: n.lu ? "background:transparent" : "" }),
              el("div", { class: "pile", style: "flex:1" }, [
                el("div", { class: "texte-sm", text: n.texte }),
                el("div", { class: "texte-xs texte-faible", text: CL.format.tempsRelatif(n.date) }),
              ]),
            ]);
            item.addEventListener("click", () => {
              CL.notifications.marquerLue(n.id);
              fermerPanneaux();
              if (n.lien) location.hash = n.lien;
              rendreEntete();
            });
            return item;
          }))
        : ui.vide("cloche", "Aucune notification", null),
      el("a", { class: "btn-lien texte-sm", href: "#/notifications", style: "display:block;text-align:center;padding:12px;border-top:1px solid var(--bordure)", text: "Voir toutes les notifications", onclick: fermerPanneaux }),
    ]);
    ancre.appendChild(panneau);
    setTimeout(() => document.addEventListener("click", fermeSurClicExterne), 0);
  }

  function fermeSurClicExterne(e) {
    const p = document.getElementById("notif-panneau");
    const m = document.getElementById("menu-utilisateur");
    if (p && !p.parentElement.contains(e.target)) fermerPanneaux();
    if (m && !m.parentElement.contains(e.target)) fermerPanneaux();
  }
  function fermerPanneaux() {
    ["notif-panneau", "menu-utilisateur"].forEach((id) => { const n = document.getElementById(id); if (n) n.remove(); });
    document.removeEventListener("click", fermeSurClicExterne);
  }

  /* ------------------------- Menu utilisateur ------------------------ */
  function menuUtilisateur(ancre) {
    const u = auth.courant();
    if (!u) return;
    fermerPanneaux();
    const liens = [];
    if (u.role === "client") liens.push(["#/client", "dashboard", "Mon espace"]);
    if (u.role === "coach") liens.push(["#/coach", "dashboard", "Espace coach"]);
    if (u.role === "admin") liens.push(["#/admin", "bouclier", "Administration"]);
    liens.push(["#/messages", "message", "Messagerie"]);
    if (u.role !== "admin") liens.push(["#/parametres", "parametres", "Paramètres"]);

    const menu = el("div", { class: "notif-panneau", id: "menu-utilisateur", style: "width:240px" }, [
      el("div", { style: "padding:14px 16px;border-bottom:1px solid var(--bordure)" }, [
        el("strong", { text: u.prenom + " " + u.nom }),
        el("div", { class: "texte-xs texte-faible", text: u.email }),
        el("div", { class: "badge badge-neutre mt-2", text: ({ client: "Client", coach: "Coach", admin: "Admin" })[u.role] }),
      ]),
      el("div", { style: "padding:6px" }, [
        ...liens.map(([href, icone, label]) => {
          const a = el("a", { class: "sidebar__lien", href, html: CL.icon(icone, 18) + " " + esc(label) });
          a.addEventListener("click", fermerPanneaux);
          return a;
        }),
        el("button", { class: "sidebar__lien", style: "width:100%;color:var(--rouge-alerte)", html: CL.icon("deconnexion", 18) + " Se déconnecter", onclick: () => { auth.deconnecter(); fermerPanneaux(); CL.toast.info("À bientôt !", ""); location.hash = "#/"; rendreEntete(); } }),
      ]),
    ]);
    ancre.appendChild(menu);
    setTimeout(() => document.addEventListener("click", fermeSurClicExterne), 0);
  }

  /** Menu de sélection de la langue (FR · EN · ES · DE). */
  function menuLangue(ancre) {
    if (ancre.querySelector(".notif-panneau")) { fermerPanneaux(); return; }
    fermerPanneaux();
    const active = CL.i18n.langue();
    const menu = el("div", { class: "notif-panneau", style: "width:180px" }, [
      el("div", { style: "padding:10px 14px;border-bottom:1px solid var(--bordure)" }, [
        el("strong", { class: "texte-sm", html: CL.icon("globe", 16) + " Langue / Language" }),
      ]),
      el("div", { style: "padding:6px" }, CL.i18n.langues.map((code) => {
        const b = el("button", {
          class: "sidebar__lien" + (code === active ? " actif" : ""), style: "width:100%",
          html: CL.i18n.drapeaux[code] + " " + esc(CL.i18n.noms[code]) + (code === active ? " ✓" : ""),
        });
        b.addEventListener("click", () => { fermerPanneaux(); CL.i18n.definirLangue(code); });
        return b;
      })),
    ]);
    ancre.appendChild(menu);
    setTimeout(() => document.addEventListener("click", fermeSurClicExterne), 0);
  }

  /* ------------------------------ En-tête ---------------------------- */
  function rendreEntete() {
    const hote = document.getElementById("entete");
    if (!hote) return;
    CL.dom.vider(hote);
    const u = auth.courant();
    const route = location.hash || "#/";

    // Navigation adaptée au rôle : le coach ne voit ni l'accueil public,
    // ni la recherche/CoachMatch (réservés aux clients), mais son espace.
    let liensNav;
    if (u && u.role === "coach") {
      liensNav = [
        lienNav("#/espace-coach", "Tableau de bord", route),
        lienNav("#/espace-coach/reservations", "Mes demandes", route),
        lienNav("#/espace-coach/profil", "Mon profil", route),
        lienNav("#/messages", "Messagerie", route),
      ];
    } else if (u && u.role === "admin") {
      liensNav = [
        lienNav("#/admin", "Administration", route),
        lienNav("#/admin/utilisateurs", "Utilisateurs", route),
        lienNav("#/recherche", "Coachs", route),
      ];
    } else {
      liensNav = [
        lienNav("#/", "Accueil", route),
        lienNav("#/recherche", "Trouver un coach", route),
        lienNav("#/coachmatch", "CoachMatch", route),
        lienNav("#/comment-ca-marche", "Comment ça marche", route),
      ];
    }
    const nav = el("nav", { class: "entete__nav" }, liensNav);

    // Destination du logo selon le rôle (le coach reste dans son espace).
    const accueilRole = u ? (u.role === "coach" ? "#/espace-coach" : u.role === "admin" ? "#/admin" : "#/") : "#/";

    const actions = el("div", { class: "entete__actions" });

    // Sélecteur de langue (FR · EN · ES · DE)
    const ancreLangue = el("div", { style: "position:relative" });
    const btnLangue = el("button", { class: "btn-icone btn-fantome", "aria-label": "Changer de langue / Change language", title: "Langue / Language", html: CL.icon("globe", 20) });
    btnLangue.addEventListener("click", (e) => { e.stopPropagation(); menuLangue(ancreLangue); });
    ancreLangue.appendChild(btnLangue);
    actions.appendChild(ancreLangue);

    // Bouton thème
    actions.appendChild(el("button", {
      class: "btn-icone btn-fantome", "aria-label": "Basculer le thème",
      html: CL.icon(themeCourant() === "dark" ? "soleil" : "lune", 20),
      onclick: basculerTheme,
    }));

    if (u) {
      // Cloche
      const nbNotif = CL.notifications.nbNonLues(u.id);
      const cloche = el("div", { class: "cloche", style: "position:relative" });
      const btnCloche = el("button", { class: "btn-icone btn-fantome", "aria-label": "Notifications", html: CL.icon("cloche", 20) });
      btnCloche.addEventListener("click", (e) => { e.stopPropagation(); panneauNotifications(cloche); });
      cloche.appendChild(btnCloche);
      if (nbNotif > 0) cloche.appendChild(el("span", { class: "cloche__pastille", text: nbNotif > 9 ? "9+" : String(nbNotif) }));
      actions.appendChild(cloche);

      // Avatar / menu
      const ancreMenu = el("div", { style: "position:relative" });
      const btnAvatar = el("button", { class: "btn-icone", "aria-label": "Menu utilisateur", style: "padding:0" }, [
        ui.avatarNom(u.prenom + " " + u.nom, "avatar-sm", "#1b4dcc"),
      ]);
      btnAvatar.addEventListener("click", (e) => { e.stopPropagation(); menuUtilisateur(ancreMenu); });
      ancreMenu.appendChild(btnAvatar);
      actions.appendChild(ancreMenu);
    } else {
      actions.appendChild(el("a", { class: "btn btn-fantome", href: "#/connexion" }, [el("span", { class: "label-btn", text: "Connexion" })]));
      actions.appendChild(el("a", { class: "btn btn-cta", href: "#/inscription", html: CL.icon("plus", 16) + '<span class="label-btn"> S\'inscrire</span>' }));
    }

    const burger = el("button", { class: "btn-icone btn-fantome burger", "aria-label": "Menu", html: CL.icon("menu", 22) });
    burger.addEventListener("click", basculerSidebarMobile);

    hote.appendChild(el("div", { class: "entete__inner" }, [
      burger,
      el("a", { class: "logo", href: accueilRole }, [
        el("span", { class: "logo__pastille", text: "C" }),
        el("span", {}, [document.createTextNode("Coach"), el("span", { class: "logo__marque", text: "Link" }), document.createTextNode(" CI")]),
      ]),
      nav,
      actions,
    ]));

    // Synchronise la barre de navigation mobile (état actif, compteurs).
    rendreBottomNav();
  }

  function lienNav(href, label, route) {
    const actif = route === href || (href !== "#/" && route.startsWith(href));
    return el("a", { href, class: actif ? "actif" : "", text: label });
  }

  /* ---------------- Barre de navigation mobile (tab bar app) --------- */
  // Style « application native » : visible uniquement sur téléphone (CSS).
  function rendreBottomNav() {
    let nav = document.getElementById("bottom-nav");
    if (!nav) {
      nav = el("nav", { class: "bottom-nav", id: "bottom-nav", "aria-label": "Navigation principale" });
      document.body.appendChild(nav);
    }
    CL.dom.vider(nav);

    const u = auth.courant();
    const route = location.hash || "#/";
    const nbMsg = u ? CL.messageService.nbNonLus(u.id) : 0;

    const nbNotif = u ? CL.notifications.nbNonLues(u.id) : 0;
    let items;
    if (u && u.role === "coach") {
      // Barre dédiée coach : aucun accès à l'accueil, la recherche ou Match.
      items = [
        { href: "#/espace-coach", icone: "dashboard", label: "Bord" },
        { href: "#/espace-coach/reservations", icone: "calendrier", label: "Demandes" },
        { href: "#/espace-coach/profil", icone: "utilisateur", label: "Profil", centre: true },
        { href: "#/messages", icone: "message", label: "Messages", compteur: nbMsg },
        { href: "#/notifications", icone: "cloche", label: "Notifs", compteur: nbNotif },
      ];
    } else if (u && u.role === "admin") {
      items = [
        { href: "#/admin", icone: "dashboard", label: "Bord" },
        { href: "#/admin/diplomes", icone: "diplome", label: "Diplômes" },
        { href: "#/admin/utilisateurs", icone: "utilisateurs", label: "Comptes", centre: true },
        { href: "#/admin/litiges", icone: "bouclier", label: "Litiges" },
        { href: "#/messages", icone: "message", label: "Messages", compteur: nbMsg },
      ];
    } else {
      // Client / visiteur : parcours de découverte complet.
      items = [
        { href: "#/", icone: "dashboard", label: "Accueil" },
        { href: "#/recherche", icone: "recherche", label: "Coachs" },
        { href: "#/coachmatch", icone: "eclair", label: "Match", centre: true },
      ];
      if (u) {
        items.push({ href: "#/messages", icone: "message", label: "Messages", compteur: nbMsg });
        items.push({ href: "#/client", icone: "utilisateur", label: "Espace" });
      } else {
        items.push({ href: "#/comment-ca-marche", icone: "bouclier", label: "Aide" });
        items.push({ href: "#/connexion", icone: "utilisateur", label: "Compte" });
      }
    }

    items.forEach((it) => {
      const base = it.href.split("?")[0];
      const actif = route === it.href || route === base || (base !== "#/" && route.startsWith(base));
      const item = el("a", {
        href: it.href,
        class: "bottom-nav__item" + (actif ? " actif" : "") + (it.centre ? " bottom-nav__centre" : ""),
      }, [
        el("span", { class: "bottom-nav__icone", html: CL.icon(it.icone, it.centre ? 24 : 22, { fill: it.centre && it.icone === "eclair" }) }),
        el("span", { class: "bottom-nav__label", text: it.label }),
        it.compteur ? el("span", { class: "bottom-nav__pastille", text: it.compteur > 9 ? "9+" : String(it.compteur) }) : null,
      ]);
      nav.appendChild(item);
    });
  }

  /* ------------------------- Menu mobile intelligent ----------------- */
  // Sur les pages de tableau de bord : bascule la sidebar existante.
  // Sur les pages publiques (pas de sidebar) : ouvre un tiroir de navigation.
  function basculerSidebarMobile() {
    const sb = document.querySelector(".sidebar");
    if (sb) {
      const ov = document.querySelector(".sidebar-overlay");
      sb.classList.toggle("ouvert");
      if (ov) ov.classList.toggle("ouvert");
    } else {
      basculerMenuPublic();
    }
  }

  function basculerMenuPublic() {
    const existant = document.getElementById("menu-mobile");
    if (existant) { fermerMenuPublic(); return; }

    const u = auth.courant();
    const route = location.hash || "#/";
    const lien = (href, label, icone) => {
      const a = el("a", { class: "menu-mobile__lien" + (route === href || (href !== "#/" && route.startsWith(href)) ? " actif" : ""), href, html: CL.icon(icone, 20) + " " + esc(label) });
      a.addEventListener("click", fermerMenuPublic);
      return a;
    };

    let liens;
    if (u && u.role === "coach") {
      // Menu dédié coach — pas d'accueil public, recherche ni Match.
      liens = [
        lien("#/espace-coach", "Tableau de bord", "dashboard"),
        lien("#/espace-coach/reservations", "Mes demandes", "calendrier"),
        lien("#/espace-coach/profil", "Mon profil", "utilisateur"),
        lien("#/espace-coach/mur", "Mon mur", "document"),
        lien("#/espace-coach/galerie", "Ma galerie", "galerie"),
        lien("#/espace-coach/disponibilites", "Disponibilités", "horloge"),
        lien("#/espace-coach/diplomes", "Diplômes", "diplome"),
        lien("#/espace-coach/avis", "Avis reçus", "etoile"),
        lien("#/messages", "Messagerie", "message"),
        lien("#/notifications", "Notifications", "cloche"),
        lien("#/parametres", "Paramètres", "parametres"),
      ];
    } else if (u && u.role === "admin") {
      liens = [
        lien("#/admin", "Administration", "dashboard"),
        lien("#/admin/diplomes", "Diplômes", "diplome"),
        lien("#/admin/utilisateurs", "Utilisateurs", "utilisateurs"),
        lien("#/admin/litiges", "Litiges", "bouclier"),
        lien("#/messages", "Messagerie", "message"),
        lien("#/notifications", "Notifications", "cloche"),
      ];
    } else {
      liens = [
        lien("#/", "Accueil", "dashboard"),
        lien("#/recherche", "Trouver un coach", "recherche"),
        lien("#/coachmatch", "CoachMatch", "eclair"),
        lien("#/comment-ca-marche", "Comment ça marche", "bouclier"),
      ];
      if (u) {
        liens.push(lien("#/client", "Mon espace", "utilisateur"));
        liens.push(lien("#/messages", "Messagerie", "message"));
        liens.push(lien("#/notifications", "Notifications", "cloche"));
      }
    }

    const actions = u
      ? el("button", { class: "btn btn-fantome btn-bloc", style: "color:var(--rouge-alerte)", html: CL.icon("deconnexion", 18) + " Se déconnecter", onclick: () => { auth.deconnecter(); fermerMenuPublic(); CL.toast.info("À bientôt !", ""); location.hash = "#/"; rendreEntete(); } })
      : el("div", { class: "pile-2" }, [
          el("a", { class: "btn btn-fantome btn-bloc", href: "#/connexion", text: "Connexion", onclick: fermerMenuPublic }),
          el("a", { class: "btn btn-cta btn-bloc", href: "#/inscription", text: "S'inscrire", onclick: fermerMenuPublic }),
        ]);

    const drawer = el("nav", { class: "menu-mobile", id: "menu-mobile" }, [
      el("div", { class: "menu-mobile__entete" }, [
        el("strong", { text: "Navigation" }),
        el("button", { class: "btn-icone btn-fantome", "aria-label": "Fermer", html: CL.icon("fermer", 22), onclick: fermerMenuPublic }),
      ]),
      el("div", { class: "menu-mobile__liens" }, liens),
      el("div", { class: "menu-mobile__pied" }, [actions]),
    ]);
    const overlay = el("div", { class: "menu-mobile-overlay", id: "menu-mobile-overlay" });
    overlay.addEventListener("click", fermerMenuPublic);

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.style.overflow = "hidden";
    // Animation d'entrée.
    requestAnimationFrame(() => { drawer.classList.add("ouvert"); overlay.classList.add("ouvert"); });
  }

  function fermerMenuPublic() {
    const d = document.getElementById("menu-mobile");
    const o = document.getElementById("menu-mobile-overlay");
    if (d) { d.classList.remove("ouvert"); setTimeout(() => d.remove(), 260); }
    if (o) { o.classList.remove("ouvert"); setTimeout(() => o.remove(), 260); }
    document.body.style.overflow = "";
  }

  /**
   * Construit une sidebar de tableau de bord.
   * @param {Array} items [{href, icone, label, compteur}]
   * @param {string} titre
   */
  function sidebar(titre, items, routeActive) {
    const nav = el("nav", { class: "sidebar" }, [
      el("div", { class: "sidebar__titre", text: titre }),
      ...items.map((it) => {
        const actif = routeActive === it.href;
        return el("a", { class: "sidebar__lien" + (actif ? " actif" : ""), href: it.href }, [
          el("span", { html: CL.icon(it.icone, 20) }),
          el("span", { text: it.label }),
          it.compteur ? el("span", { class: "compteur", text: String(it.compteur) }) : null,
        ]);
      }),
    ]);
    return nav;
  }

  /* ------------------------------ Pied ------------------------------- */
  function pied() {
    return el("footer", { class: "pied" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "pied__grille" }, [
          el("div", {}, [
            el("div", { class: "logo mb-3" }, [
              el("span", { class: "logo__pastille", text: "C" }),
              el("span", {}, [document.createTextNode("Coach"), el("span", { class: "logo__marque", text: "Link" }), document.createTextNode(" CI")]),
            ]),
            el("p", { class: "texte-sm", style: "max-width:34ch", text: "La plateforme de confiance qui connecte coachs et clients en Côte d'Ivoire. Diplômes vérifiés, avis authentiques, réservation simple." }),
            el("div", { class: "rangee gap-2 mt-4" }, [
              iconeSociale("facebook"), iconeSociale("linkedin"), iconeSociale("instagram"), iconeSociale("tiktok"),
            ]),
          ]),
          colonnePied("Plateforme", [["Trouver un coach", "#/recherche"], ["Comment ça marche", "#/comment-ca-marche"], ["Devenir coach", "#/inscription"], ["Tarifs", "#/comment-ca-marche"]]),
          colonnePied("Catégories", [["Musculation & Fitness", "#/recherche?specialite=sport"], ["Yoga & Pilates", "#/recherche?specialite=yoga"], ["Nutrition sportive", "#/recherche?specialite=nutrition"], ["Sport santé", "#/recherche?specialite=sportsante"]]),
          colonnePied("Support", [["Centre d'aide", "#/comment-ca-marche"], ["Confiance & sécurité", "#/comment-ca-marche"], ["Contact", "#/comment-ca-marche"], ["Espace admin", "#/admin"]]),
        ]),
        el("div", { class: "pied__bas" }, [
          el("span", { text: "© 2026 CoachLink CI — Tous droits réservés. Fait à Abidjan 🇨🇮" }),
          el("span", { class: "rangee gap-4" }, [
            el("a", { href: "#/comment-ca-marche", class: "texte-faible", text: "Confidentialité" }),
            el("a", { href: "#/comment-ca-marche", class: "texte-faible", text: "CGU" }),
          ]),
        ]),
      ]),
    ]);
  }

  function iconeSociale(reseau) {
    const map = { facebook: "facebook", linkedin: "linkedin", instagram: "instagram", tiktok: "tiktok" };
    return el("a", { class: "btn-icone btn-fantome", href: "#/", "aria-label": reseau, title: reseau, html: CL.icon(map[reseau], 20, { fill: reseau === "facebook" }) });
  }

  function colonnePied(titre, liens) {
    return el("div", {}, [
      el("h4", { text: titre }),
      ...liens.map(([label, href]) => el("a", { href, text: label })),
    ]);
  }

  CL.layout = {
    rendreEntete, themeCourant, basculerTheme, sidebar, pied,
    basculerSidebarMobile, fermerPanneaux, fermerMenuPublic, rendreBottomNav,
  };
})();

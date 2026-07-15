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

  /* ------------------------------ En-tête ---------------------------- */
  function rendreEntete() {
    const hote = document.getElementById("entete");
    if (!hote) return;
    CL.dom.vider(hote);
    const u = auth.courant();
    const route = location.hash || "#/";

    const nav = el("nav", { class: "entete__nav" }, [
      lienNav("#/", "Accueil", route),
      lienNav("#/recherche", "Trouver un coach", route),
      lienNav("#/comment-ca-marche", "Comment ça marche", route),
    ]);

    const actions = el("div", { class: "entete__actions" });

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
      el("a", { class: "logo", href: "#/" }, [
        el("span", { class: "logo__pastille", text: "C" }),
        el("span", {}, [document.createTextNode("Coach"), el("span", { class: "logo__marque", text: "Link" }), document.createTextNode(" CI")]),
      ]),
      nav,
      actions,
    ]));
  }

  function lienNav(href, label, route) {
    const actif = route === href || (href !== "#/" && route.startsWith(href));
    return el("a", { href, class: actif ? "actif" : "", text: label });
  }

  /* ------------------------- Sidebar tableau de bord ----------------- */
  function basculerSidebarMobile() {
    const sb = document.querySelector(".sidebar");
    const ov = document.querySelector(".sidebar-overlay");
    if (sb) sb.classList.toggle("ouvert");
    if (ov) ov.classList.toggle("ouvert");
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
          colonnePied("Catégories", [["Sport & Fitness", "#/recherche?specialite=sport"], ["Bien-être", "#/recherche?specialite=yoga"], ["Business", "#/recherche?specialite=business"], ["Scolaire", "#/recherche?specialite=scolaire"]]),
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
    basculerSidebarMobile, fermerPanneaux,
  };
})();

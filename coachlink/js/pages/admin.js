/* ==========================================================================
   pages/admin.js — Tableau de bord admin : statistiques, modération des
   diplômes, gestion des utilisateurs, file de litiges.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, esc } = CL.dom;
  const { coachService, bookingService, ui, format, storage } = CL;

  /* ---------------------------- Statistiques ---------------------- */
  CL.pages.adminAccueil = function () {
    const coachs = coachService.lister();
    const users = storage.lire(storage.CLES.users, []);
    const resas = bookingService.lister();
    const revenus = resas.filter((r) => r.paiement).reduce((s, r) => s + r.prix, 0);
    const enAttente = coachService.diplomesEnAttente().length;

    const page = el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Tableau de bord admin" }), el("p", { text: "Vue d'ensemble de la plateforme CoachLink CI." })])]),
      el("div", { class: "grille grille-4 mb-5" }, [
        CL.statCarte("utilisateurs", "var(--bleu-confiance)", users.length + coachs.length, "Comptes"),
        CL.statCarte("diplome", "var(--orange-cta)", enAttente, "Diplômes à valider"),
        CL.statCarte("calendrier", "var(--vert-validation)", resas.length, "Réservations"),
        CL.statCarte("portefeuille", "#8b3ff0", format.fcfa(revenus).replace(" FCFA", ""), "Volume (FCFA)"),
      ]),
    ]);

    // Graphiques
    page.appendChild(el("div", { class: "deux-colonnes" }, [
      el("div", { class: "carte carte-corps" }, [
        el("h3", { class: "mb-2", text: "Coachs par catégorie" }),
        graphiqueCategories(coachs),
      ]),
      el("div", { class: "carte carte-corps" }, [
        el("h3", { class: "mb-2", text: "Répartition des rôles" }),
        repartitionRoles(users, coachs),
      ]),
    ]));

    // Diplômes à valider (aperçu)
    page.appendChild(el("div", { class: "rangee entre mt-5 mb-3" }, [el("h3", { text: "Diplômes en attente" }), el("a", { class: "btn-lien", href: "#/admin/diplomes", text: "Gérer" })]));
    const attente = coachService.diplomesEnAttente().slice(0, 3);
    page.appendChild(attente.length ? el("div", { class: "pile-3" }, attente.map((x) => ligneDiplome(x, () => CL.router.rendre()))) : ui.vide("check", "Tout est à jour", "Aucun diplôme en attente de validation."));
    return page;
  };

  /* ------------------------ Modération diplômes ------------------- */
  CL.pages.adminDiplomes = function () {
    const zone = el("div", { class: "pile-3" });
    function rendre() {
      CL.dom.vider(zone);
      const liste = coachService.diplomesEnAttente();
      if (!liste.length) { zone.appendChild(ui.vide("check", "File vide", "Aucun diplôme en attente de vérification.")); return; }
      liste.forEach((x) => zone.appendChild(ligneDiplome(x, rendre)));
    }
    rendre();
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Modération des diplômes" }), el("p", { text: "Validez ou refusez les qualifications soumises." })])]), zone]);
  };

  function ligneDiplome(x, onChange) {
    const { coach, diplome } = x;
    return el("div", { class: "carte carte-corps" }, [
      el("div", { class: "rangee entre rangee-wrap gap-3" }, [
        el("div", { class: "rangee gap-3" }, [
          el("div", { class: "diplome-item__vignette", html: CL.icon("diplome", 22) }),
          el("div", {}, [
            el("strong", { text: diplome.titre }),
            el("div", { class: "texte-sm texte-doux", text: diplome.ecole + " · " + diplome.annee }),
            el("a", { class: "texte-xs", href: "#/coach/" + coach.id, text: "Coach : " + coachService.nomComplet(coach) }),
          ]),
        ]),
        el("div", { class: "rangee gap-2" }, [
          el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("oeil", 16) + " Voir", onclick: () => CL.toast.info("Document", "Aperçu du fichier (simulé).") }),
          el("button", { class: "btn btn-danger btn-sm", text: "Refuser", onclick: () => { coachService.statutDiplome(coach.id, diplome.id, "refuse"); CL.toast.info("Refusé", diplome.titre); onChange(); } }),
          el("button", { class: "btn btn-succes btn-sm", html: CL.icon("check", 16) + " Valider", onclick: () => { coachService.statutDiplome(coach.id, diplome.id, "verifie"); CL.toast.succes("Validé", "Badge « Vérifié » attribué."); onChange(); } }),
        ]),
      ]),
    ]);
  }

  /* ------------------------- Utilisateurs ------------------------- */
  CL.pages.adminUtilisateurs = function () {
    const coachs = coachService.lister();
    const users = storage.lire(storage.CLES.users, []);

    const lignesCoach = coachs.map((c) => ligneUser({
      nom: coachService.nomComplet(c), email: c.email, role: "Coach",
      detail: c.commune, note: format.note(c.note), lien: "#/coach/" + c.id,
      badge: coachService.badges(c).some((b) => b.cle === "verifie") ? "Vérifié" : "Non vérifié",
    }));
    const lignesUser = users.filter((u) => u.role !== "admin").map((u) => ligneUser({
      nom: u.prenom + " " + u.nom, email: u.email, role: ({ client: "Client", coach: "Coach", admin: "Admin" })[u.role],
      detail: format.date(u.creeLe), note: "—", badge: u.source === "email" ? "Email" : u.source,
    }));

    const table = el("div", { class: "table-wrap" }, [
      el("table", { class: "tableau" }, [
        el("thead", {}, [el("tr", {}, [th("Nom"), th("Email"), th("Rôle"), th("Détail"), th("Note"), th("Statut")])]),
        el("tbody", {}, [...lignesCoach, ...lignesUser]),
      ]),
    ]);
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Utilisateurs" }), el("p", { text: (coachs.length + users.length) + " comptes au total." })])]), table]);
  };

  function ligneUser(d) {
    return el("tr", {}, [
      el("td", {}, [d.lien ? el("a", { href: d.lien, class: "gras", text: d.nom }) : el("strong", { text: d.nom })]),
      el("td", { class: "texte-doux", text: d.email }),
      el("td", {}, [el("span", { class: "badge badge-neutre", text: d.role })]),
      el("td", { class: "texte-doux", text: d.detail || "—" }),
      el("td", { text: d.note }),
      el("td", {}, [el("span", { class: "badge " + (d.badge === "Vérifié" ? "badge-verifie" : "badge-neutre"), text: d.badge })]),
    ]);
  }

  /* ---------------------------- Litiges --------------------------- */
  CL.pages.adminLitiges = function () {
    const zone = el("div", { class: "pile-3" });
    function rendre() {
      CL.dom.vider(zone);
      const liste = CL.litiges.lister();
      if (!liste.length) { zone.appendChild(ui.vide("bouclier", "Aucun litige", "Tout roule ! Aucune réclamation en cours.")); return; }
      liste.forEach((l) => {
        const statutMap = { ouvert: ["st-attente", "Ouvert"], en_cours: ["st-confirme", "En cours"], resolu: ["st-termine", "Résolu"] };
        const [cls, label] = statutMap[l.statut] || ["st-attente", l.statut];
        zone.appendChild(el("div", { class: "carte carte-corps" }, [
          el("div", { class: "rangee entre rangee-wrap gap-3" }, [
            el("div", {}, [
              el("strong", { text: l.motif }),
              el("div", { class: "texte-sm texte-doux", text: l.client + " ⇄ " + (l.coach || "—") }),
              el("div", { class: "texte-xs texte-faible", text: "Ouvert le " + format.date(l.date) }),
            ]),
            el("div", { class: "rangee gap-2" }, [
              el("span", { class: "pastille-statut " + cls, text: label }),
              l.statut === "ouvert" ? el("button", { class: "btn btn-fantome btn-sm", text: "Prendre en charge", onclick: () => {
                CL.litiges.changerStatut(l.id, "en_cours"); CL.toast.info("Litige en cours", ""); rendre();
              } }) : null,
              l.statut !== "resolu" ? el("button", { class: "btn btn-succes btn-sm", text: "Marquer résolu", onclick: () => {
                CL.litiges.changerStatut(l.id, "resolu"); CL.toast.succes("Litige résolu", ""); rendre();
              } }) : null,
            ]),
          ]),
        ]));
      });
    }
    rendre();
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Litiges" }), el("p", { text: "Gérez les réclamations entre clients et coachs." })])]), zone]);
  };

  /* --------------------------- Graphiques ------------------------- */
  function graphiqueCategories(coachs) {
    const cats = {};
    coachs.forEach((c) => { cats[c.categorie] = (cats[c.categorie] || 0) + 1; });
    const entrees = Object.entries(cats);
    const max = Math.max(...entrees.map(([, v]) => v));
    return el("div", { class: "bar-chart" }, entrees.map(([cat, v]) => el("div", { class: "bar-chart__col" }, [
      el("strong", { class: "texte-sm", text: String(v) }),
      el("div", { class: "bar-chart__barre", style: `height:${(v / max) * 100}%` }),
      el("div", { class: "bar-chart__label", text: cat }),
    ])));
  }

  function repartitionRoles(users, coachs) {
    const nbCoach = coachs.length;
    const nbClient = users.filter((u) => u.role === "client").length;
    const nbAdmin = users.filter((u) => u.role === "admin").length;
    const total = nbCoach + nbClient + nbAdmin || 1;
    const items = [
      ["Coachs", nbCoach, "var(--bleu-confiance)"],
      ["Clients", nbClient, "var(--vert-validation)"],
      ["Admins", nbAdmin, "var(--orange-cta)"],
    ];
    return el("div", { class: "pile-3", style: "padding-top:12px" }, items.map(([label, v, couleur]) => el("div", {}, [
      el("div", { class: "rangee entre texte-sm mb-2" }, [el("span", { text: label }), el("strong", { text: v + " (" + Math.round((v / total) * 100) + "%)" })]),
      el("div", { style: "height:12px;background:var(--surface-2);border-radius:99px;overflow:hidden" }, [el("div", { style: `width:${(v / total) * 100}%;height:100%;background:${couleur}` })]),
    ])));
  }

  function th(t) { return el("th", { text: t }); }
})();

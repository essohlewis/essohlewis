/* ==========================================================================
   pages/abonnement.js — Abonnements mensuels : demande (client), programme
   (coach), paiement mensuel. Lieu géolocalisé (GPS / Google Maps).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { auth, abonnementService, coachService, bookingService, ui, format } = CL;

  const HEURES = ["06:00", "07:00", "08:00", "09:00", "10:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  function champ(label, input, aide) {
    return el("div", { class: "champ" }, [el("label", { text: label }), input, aide ? el("div", { class: "aide", text: aide }) : null]);
  }
  function badgeStatut(s) {
    const map = { demande: ["st-attente", "En attente du coach"], propose: ["st-confirme", "Programme proposé"], actif: ["st-termine", "Actif"], termine: ["st-annule", "Terminé"], annule: ["st-annule", "Annulé"] };
    const [cls, lbl] = map[s] || ["st-attente", s];
    return el("span", { class: "pastille-statut " + cls, text: lbl });
  }

  /* --------------------- Contrat d'accompagnement ----------------- */
  function texteContrat(a) {
    const lieu = CL.profilCat ? CL.profilCat.lieu(a.lieuType).label : a.lieuType;
    const detail = CL.localisation && CL.localisation.resume(a) ? " — " + CL.localisation.resume(a) : "";
    const prog = Object.keys(a.programme || {}).filter((j) => (a.programme[j] || []).length).map((j) => j + " " + a.programme[j].join("/")).join(" · ") || "à convenir";
    const d = (iso) => iso ? new Date(iso).toLocaleString("fr-FR") : "—";

    // Récapitulatif horodaté des séances validées (preuve d'exécution).
    const seancesParMois = {};
    (a.seances || []).forEach((s) => { (seancesParMois[s.mois] = seancesParMois[s.mois] || []).push(s.date); });
    const recap = [];
    const paie = (a.paiements || []).slice().sort((x, y) => String(x.mois).localeCompare(String(y.mois)));
    if (paie.length) {
      recap.push("", "DÉCOMPTE DES SÉANCES (preuve horodatée) :");
      paie.forEach((p) => {
        const etat = p.libere ? (Number(p.rembourse) > 0 ? "réglé au prorata" : "mensualité créditée au coach") : "sous séquestre (en attente)";
        recap.push("  " + p.mois + " : " + (Number(p.seancesValidees) || 0) + "/" + (Number(p.seancesPrevues) || 0) + " séances validées — " + etat);
        if (Number(p.rembourse) > 0) recap.push("    Part coach : " + format.fcfa(Number(p.montantLibere) || 0) + " · Remboursé au client : " + format.fcfa(p.rembourse));
        (seancesParMois[p.mois] || []).forEach((dt, i) => recap.push("    Séance " + (i + 1) + " validée le " + d(dt)));
      });
    }

    return [
      "CONTRAT D'ACCOMPAGNEMENT MENSUEL — CoachLink CI",
      "Référence : " + (a.contratRef || "—"),
      "",
      "Entre le coach : " + a.coachNom,
      "Et le client   : " + a.clientNom,
      "",
      "Objet : accompagnement « " + a.objectif + " »",
      "Fréquence : " + a.seancesSemaine + " séance(s) / semaine",
      "Programme hebdomadaire : " + prog,
      "Lieu : " + lieu + detail,
      "Tarif mensuel : " + format.fcfa(a.prixMensuel) + " (hors abonnement salle)",
      "Abonnement salle inclus : " + (a.inclutSalle ? "oui" : "non"),
      "Période : " + d(a.dateDebut) + (a.dateFin ? " → " + d(a.dateFin) : ""),
      "",
      "Modalité de règlement : la mensualité est versée au coach uniquement après",
      "validation par QR de toutes les séances du mois. En cas de résiliation, la",
      "part non effectuée est remboursée au client (prorata des séances).",
    ].concat(recap).concat([
      "",
      "Signatures (horodatage électronique) :",
      "  Coach  : " + d(a.contratCoachLe),
      "  Client : " + d(a.contratClientLe),
      "",
      "Ce contrat vaut preuve de l'accord des parties sur la plateforme CoachLink CI.",
    ]).join("\n");
  }

  function telechargerContrat(a) {
    const blob = new Blob([texteContrat(a)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const lien = el("a", { href: url, download: "contrat-" + (a.contratRef || a.id) + ".txt" });
    document.body.appendChild(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function ouvrirContrat(a) {
    CL.modal.ouvrir({
      titre: "Contrat d'accompagnement",
      contenu: el("div", { class: "pile-3" }, [
        el("div", { class: "badge badge-verifie", text: "Preuve conservée · " + (a.contratRef || "") }),
        el("pre", { style: "white-space:pre-wrap;font-family:inherit;font-size:var(--fs-sm);background:var(--surface-2);padding:14px;border-radius:10px;margin:0", text: texteContrat(a) }),
        el("div", { class: "rangee gap-4 texte-xs texte-faible" }, [
          el("span", { text: (a.contratCoachLe ? "✅" : "⏳") + " Signé coach" }),
          el("span", { text: (a.contratClientLe ? "✅" : "⏳") + " Signé client" }),
        ]),
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Fermer", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-primaire", html: CL.icon("document", 16) + " Télécharger", onclick: () => telechargerContrat(a) }),
      ],
    });
  }
  CL.ouvrirContratAbonnement = ouvrirContrat;

  /* ==================== DEMANDE D'ABONNEMENT (client) =============== */
  CL.ouvrirAbonnement = function (coach) {
    if (!auth.estConnecte()) { CL.toast.info("Connexion requise", ""); location.hash = "#/connexion"; return; }
    const u = auth.courant();
    const pf = CL.profilCat.pour(coach);

    const objectif = el("select", { class: "select" }, pf.objectifs.map((o) => el("option", { value: o, text: o })));
    const seances = el("select", { class: "select" }, [1, 2, 3, 4, 5].map((n) => el("option", { value: n, text: n + " " + (n > 1 ? pf.termePluriel : pf.terme) + " / semaine" })));
    const prixTarif = coachService.prixMin(coach) || 10000;

    // Lieu (dépend de la catégorie : salle, cabinet, domicile, en ligne…).
    let lieuType = pf.lieux[0];
    const zoneLieu = el("div", { class: "mt-2" });
    let locChamp = null;
    function rendreLieu() {
      CL.dom.vider(zoneLieu);
      const cfg = CL.profilCat.lieu(lieuType);
      if (cfg.enLigne) {
        zoneLieu.appendChild(el("p", { class: "texte-sm texte-doux", text: "Séances en visioconférence : le lien vous sera transmis après confirmation." }));
        locChamp = null;
      } else if (!cfg.adresse) {
        zoneLieu.appendChild(el("p", { class: "texte-sm texte-doux", text: cfg.label + " (" + (coach.commune || "lieu à convenir") + ")." }));
        locChamp = null;
      } else {
        locChamp = CL.localisation.champ({ ville: "Abidjan", commune: coach.commune }, { salle: cfg.nomLieu });
        zoneLieu.appendChild(el("p", { class: "texte-sm texte-doux mb-2", text: lieuType === "domicile" ? "Indiquez votre domicile (position GPS recommandée)." : "Indiquez le lieu (nom, immeuble/bâtiment/localité) et sa position." }));
        zoneLieu.appendChild(locChamp.el);
      }
    }
    const radiosLieu = el("div", { class: "rangee gap-2 rangee-wrap mb-1" }, pf.lieux.map((k) => {
      const b = el("button", { class: "chip" + (k === lieuType ? " actif" : ""), type: "button", text: CL.profilCat.lieu(k).label });
      b.addEventListener("click", () => { lieuType = k; radiosLieu.querySelectorAll(".chip").forEach((x) => x.classList.remove("actif")); b.classList.add("actif"); rendreLieu(); });
      return b;
    }));

    // Prix
    let fixePar = "client";
    const prixSeance = el("input", { class: "input", type: "number", min: "0", step: "500", value: String(prixTarif) });
    const estim = el("div", { class: "texte-sm gras mt-1" });
    function majEstim() {
      const total = abonnementService.prixMensuel(prixSeance.value, seances.value);
      estim.textContent = "≈ " + format.fcfa(total) + " / mois" + (pf.salle ? " (hors abonnement à la salle)" : "");
    }
    const zonePrix = el("div", { class: "mt-2" }, [champ("Prix par séance (FCFA)", prixSeance, "× " + "séances/semaine × 4 semaines"), estim]);
    const radiosPrix = el("div", { class: "rangee gap-2 rangee-wrap" }, [["client", "Je propose un prix"], ["coach", "Laisser le coach fixer"]].map(([k, lbl], i) => {
      const b = el("button", { class: "chip" + (i === 0 ? " actif" : ""), type: "button", text: lbl });
      b.addEventListener("click", () => { fixePar = k; radiosPrix.querySelectorAll(".chip").forEach((x) => x.classList.remove("actif")); b.classList.add("actif"); zonePrix.style.display = k === "client" ? "block" : "none"; });
      return b;
    }));
    prixSeance.addEventListener("input", majEstim);
    seances.addEventListener("change", majEstim);
    majEstim();
    rendreLieu();

    const inclutSalle = el("input", { type: "checkbox" });

    CL.modal.ouvrir({
      titre: "Abonnement mensuel avec " + coach.prenom,
      contenu: el("div", { class: "pile-4" }, [
        el("p", { class: "texte-sm texte-doux", text: pf.accroche }),
        champ("Votre objectif", objectif),
        champ("Fréquence", seances),
        el("div", {}, [el("label", { class: "champ", style: "font-weight:600;display:block;margin-bottom:6px", text: pf.questionLieu }), radiosLieu, zoneLieu]),
        el("div", {}, [el("label", { class: "champ", style: "font-weight:600;display:block;margin-bottom:6px", text: "Tarification" }), radiosPrix, zonePrix]),
        pf.salle ? el("label", { class: "rangee gap-2 texte-sm", style: "cursor:pointer" }, [inclutSalle, el("span", { text: "Inclure l'abonnement à la salle de sport dans le prix" })]) : null,
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", text: "Envoyer la demande", onclick: soumettre }),
      ],
    });

    async function soumettre(e) {
      const btn = e.currentTarget; btn.disabled = true;
      const loc = locChamp ? locChamp.valeur() : {};
      const d = {
        coachId: coach.id, coachNom: coachService.nomComplet(coach),
        clientId: u.id, clientNom: u.prenom + " " + u.nom,
        objectif: objectif.value, seancesSemaine: Number(seances.value),
        lieuType, lieuNom: loc.lieuNom || "", adresse: loc.adresse || "",
        ville: loc.ville || "", commune: loc.commune || "", quartier: loc.quartier || "",
        lat: loc.lat || "", lng: loc.lng || "",
        prixSeance: fixePar === "client" ? Number(prixSeance.value) : 0,
        fixePar, inclutSalle: inclutSalle.checked,
      };
      try {
        await abonnementService.creer(d);
        CL.modal.fermer();
        CL.toast.succes("Demande envoyée 🎉", "Votre coach va préparer votre programme.");
        location.hash = "#/client/abonnements";
      } catch (err) { btn.disabled = false; CL.toast.erreur("Échec", (err && err.message) || "Réessayez."); }
    }
  };

  /* ==================== CÔTÉ CLIENT : mes abonnements ============== */
  CL.pages.clientAbonnements = function () {
    const u = auth.courant();
    const liste = abonnementService.parClient(u.id);
    const zone = el("div", { class: "pile-4" });
    if (!liste.length) {
      zone.appendChild(ui.vide("calendrier", "Aucun abonnement", "Depuis le profil d'un coach, demandez un abonnement mensuel pour un suivi complet."));
    } else {
      liste.forEach((a) => zone.appendChild(carteAbonnement(a, "client")));
    }
    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes abonnements" }), el("p", { text: "Vos programmes mensuels et règlements." })])]),
      zone,
    ]);
  };

  /* ==================== CÔTÉ COACH : abonnements ================== */
  CL.pages.coachAbonnements = function () {
    const c = CL.coachCourant();
    if (!c) return ui.vide("utilisateur", "Profil coach introuvable", "");
    const zone = el("div", { class: "pile-4" });
    function rendre() {
      CL.dom.vider(zone);
      const liste = abonnementService.parCoach(c.id);
      if (!liste.length) { zone.appendChild(ui.vide("calendrier", "Aucune demande", "Les demandes d'abonnement de vos clients apparaîtront ici.")); return; }
      liste.forEach((a) => zone.appendChild(carteAbonnement(a, "coach", rendre)));
    }
    rendre();
    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Abonnements" }), el("p", { text: "Préparez les programmes mensuels de vos clients." })])]),
      zone,
    ]);
  };

  /* -------------------------- Carte d'abonnement ------------------- */
  function carteAbonnement(a, vue, onChange) {
    const cfgLieu = CL.profilCat.lieu(a.lieuType);
    const lieu = cfgLieu.label;
    const detailLieu = cfgLieu.enLigne ? "Visioconférence" : (cfgLieu.adresse ? (CL.localisation.resume(a) || "Lieu à préciser") : "Chez le coach");

    const entete = el("div", { class: "rangee entre rangee-wrap gap-3" }, [
      el("div", {}, [
        el("strong", { text: vue === "coach" ? a.clientNom : a.coachNom }),
        el("div", { class: "texte-sm texte-doux", text: a.objectif + " · " + a.seancesSemaine + " séance(s)/sem." }),
        el("div", { class: "texte-xs texte-faible", html: CL.icon("localisation", 13) + " " + lieu + " — " + detailLieu }),
      ]),
      el("div", { class: "pile", style: "align-items:flex-end;gap:6px" }, [
        badgeStatut(a.statut),
        a.prixMensuel ? el("strong", { text: format.fcfa(a.prixMensuel) + " /mois" }) : el("span", { class: "texte-xs texte-faible", text: "prix à définir" }),
      ]),
    ]);

    const corps = el("div", { class: "mt-3", style: "border-top:1px solid var(--bordure);padding-top:12px" });

    // Lien Maps si localisé.
    if ((a.lat && a.lng) || a.adresse) {
      corps.appendChild(el("a", { class: "btn-lien texte-sm", href: CL.localisation.lienMaps(a), target: "_blank", rel: "noopener", html: CL.icon("localisation", 14) + " Voir le lieu sur Google Maps" }));
    }

    // Programme (grille hebdo) si défini.
    if (a.programme && Object.keys(a.programme).some((j) => (a.programme[j] || []).length)) {
      corps.appendChild(el("div", { class: "mt-2 texte-sm" }, [el("strong", { text: "Programme hebdomadaire : " }), el("span", { text: resumeProgramme(a.programme) })]));
    }

    // Programme d'entraînement détaillé (exercices).
    if (Array.isArray(a.exercices) && a.exercices.length) {
      const details = el("details", { class: "mt-2" }, [
        el("summary", { class: "texte-sm gras", style: "cursor:pointer", html: CL.icon("document", 14) + " Programme d'entraînement (" + a.exercices.length + " exercices)" }),
        el("div", { class: "pile-2 mt-2" }, a.exercices.map((x) => el("div", { class: "carte carte-corps", style: "background:var(--surface-2);padding:8px 10px" }, [
          el("strong", { class: "texte-sm", text: x.nom }),
          el("div", { class: "texte-xs texte-doux", text: [x.series ? x.series + " séries" : null, x.repetitions ? x.repetitions + " répétitions" : null, x.repos ? "repos " + x.repos : null].filter(Boolean).join(" · ") + (x.note ? " — " + x.note : "") }),
        ]))),
      ]);
      corps.appendChild(details);
    }
    if (a.inclutSalle) corps.appendChild(el("div", { class: "texte-xs texte-faible mt-1", text: "Abonnement à la salle inclus dans le prix." }));
    else corps.appendChild(el("div", { class: "texte-xs texte-faible mt-1", text: "Abonnement à la salle non inclus." }));

    // Séquestre : progression des séances validées du mois courant.
    if (a.statut === "actif") {
      const pr = abonnementService.progresMois(a);
      if (pr.regle) {
        const barre = el("div", { style: "height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-top:4px" }, [
          el("div", { style: "height:100%;width:" + Math.round(100 * pr.validees / Math.max(1, pr.prevues)) + "%;background:" + (pr.libere ? "var(--vert-validation)" : "var(--orange-cta)") }),
        ]);
        corps.appendChild(el("div", { class: "mt-2 carte carte-corps", style: "background:var(--surface-2);padding:10px 12px" }, [
          el("div", { class: "rangee entre gap-2" }, [
            el("strong", { class: "texte-sm", text: "Séances validées ce mois : " + pr.validees + " / " + pr.prevues }),
            pr.libere ? el("span", { class: "badge badge-verifie", text: "Mensualité créditée ✓" }) : el("span", { class: "badge badge-neutre", text: "Sous séquestre" }),
          ]),
          barre,
          el("div", { class: "texte-xs texte-faible mt-1", text: pr.libere
            ? "Toutes les séances ont été validées : la mensualité a été créditée au portefeuille du coach."
            : "La mensualité (" + format.fcfa(a.prixMensuel) + ") sera versée au coach une fois les " + pr.prevues + " séances validées par QR." }),
        ]));
      }
    }

    // Actions selon la vue + le statut.
    const actions = el("div", { class: "rangee gap-2 rangee-wrap mt-3" });
    if (vue === "coach") {
      if (a.statut === "demande" || a.statut === "propose") {
        actions.appendChild(el("button", { class: "btn btn-cta btn-sm", html: CL.icon("calendrier", 15) + (a.statut === "demande" ? " Préparer le programme" : " Modifier le programme"), onclick: () => ouvrirProgramme(a, onChange) }));
      }
      if (a.statut === "demande") {
        actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", text: "Refuser", onclick: async () => { await abonnementService.changerStatut(a.id, "annule"); CL.toast.info("Refusé", ""); onChange && onChange(); } }));
      }
      if (a.statut === "actif") {
        const pr = abonnementService.progresMois(a);
        if (pr.regle && !pr.libere) {
          actions.appendChild(el("button", { class: "btn btn-succes btn-sm", html: CL.icon("qrcode", 15) + " Valider une séance (QR)", onclick: () => validerSeanceCoach(a, onChange) }));
        }
        actions.appendChild(el("button", { class: "btn btn-primaire btn-sm", html: CL.icon("document", 15) + " Programme détaillé", onclick: () => ouvrirExercices(a, onChange) }));
        actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", text: "Terminer", onclick: async () => { await abonnementService.changerStatut(a.id, "termine"); CL.toast.info("Abonnement terminé", ""); onChange && onChange(); } }));
      }
    } else { // client
      if (a.statut === "propose" || a.statut === "actif") {
        const mois = abonnementService.moisCourant();
        if (abonnementService.moisRegle(a, mois)) {
          actions.appendChild(el("span", { class: "badge badge-verifie", text: "Mois en cours réglé ✓" }));
          // Le client présente son QR de présence rotatif à chaque séance.
          if (a.jeton) actions.appendChild(el("button", { class: "btn btn-cta btn-sm", html: CL.icon("qrcode", 15) + " Mon QR de présence", onclick: () => CL.montrerQrPresence(a.jeton, "QR de présence — abonnement", "À chaque séance, présentez ce QR code à votre coach (ou dictez le code) pour valider votre présence. La mensualité ne lui sera versée qu'une fois toutes les séances validées.") }));
        } else {
          actions.appendChild(el("button", { class: "btn btn-succes btn-sm", html: CL.icon("portefeuille", 15) + " Payer le mois (" + format.fcfa(a.prixMensuel) + ")", onclick: () => payerMois(a) }));
        }
      }
      if (a.statut === "actif") {
        const auto = el("button", { class: "btn btn-sm " + (a.autoRenouvellement ? "btn-primaire" : "btn-fantome"), html: CL.icon("eclair", 15, { fill: !!a.autoRenouvellement }) + (a.autoRenouvellement ? " Renouvellement auto : activé" : " Activer le renouvellement auto") });
        auto.addEventListener("click", async () => {
          auto.disabled = true;
          const maj = await abonnementService.basculerAuto(a.id, !a.autoRenouvellement);
          a.autoRenouvellement = maj ? !!maj.autoRenouvellement : !a.autoRenouvellement;
          CL.toast.info("Renouvellement automatique", a.autoRenouvellement ? "Activé — le mois sera prélevé automatiquement." : "Désactivé.");
          onChange && onChange();
        });
        actions.appendChild(auto);
      }
      if (a.statut === "demande" || a.statut === "propose") {
        actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", text: "Annuler", onclick: async () => { await abonnementService.changerStatut(a.id, "annule"); CL.toast.info("Annulé", ""); location.hash = "#/client/abonnements"; CL.router.rendre(); } }));
      }
      if (a.coachId) actions.appendChild(el("a", { class: "btn btn-primaire btn-sm", href: "#/coach/" + a.coachId, text: "Voir le coach" }));
    }

    // Contrat (preuve) dès qu'il existe (proposé par le coach ou accepté par le client).
    if (a.contratRef) {
      actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("document", 15) + " Contrat", onclick: () => ouvrirContrat(a) }));
    }

    // Historique des règlements.
    if ((a.paiements || []).length) {
      corps.appendChild(el("div", { class: "mt-2 texte-xs texte-faible" }, [el("strong", { text: "Règlements : " }), el("span", { text: a.paiements.map((p) => p.mois).join(", ") })]));
    }
    corps.appendChild(actions);

    return el("div", { class: "carte carte-corps" }, [entete, corps]);
  }

  function resumeProgramme(prog) {
    return Object.keys(prog).filter((j) => (prog[j] || []).length).map((j) => j + " " + prog[j].join("/")).join(" · ");
  }

  /* Coach : éditeur du programme d'entraînement détaillé (exercices). */
  function ouvrirExercices(a, onChange) {
    const exos = JSON.parse(JSON.stringify(a.exercices || []));
    const liste = el("div", { class: "pile-2" });
    function rendre() {
      CL.dom.vider(liste);
      exos.forEach((x, i) => {
        const nom = el("input", { class: "input", placeholder: "Exercice (ex : Squats)", value: x.nom || "" });
        const series = el("input", { class: "input", type: "number", min: "0", placeholder: "Séries", value: x.series || "", style: "max-width:90px" });
        const reps = el("input", { class: "input", type: "number", min: "0", placeholder: "Répét.", value: x.repetitions || "", style: "max-width:90px" });
        const repos = el("input", { class: "input", placeholder: "Repos", value: x.repos || "", style: "max-width:100px" });
        const note = el("input", { class: "input", placeholder: "Note", value: x.note || "" });
        nom.addEventListener("input", () => x.nom = nom.value);
        series.addEventListener("input", () => x.series = series.value);
        reps.addEventListener("input", () => x.repetitions = reps.value);
        repos.addEventListener("input", () => x.repos = repos.value);
        note.addEventListener("input", () => x.note = note.value);
        const del = el("button", { class: "btn-icone btn-fantome", title: "Retirer", html: CL.icon("poubelle", 15), onclick: () => { exos.splice(i, 1); rendre(); } });
        liste.appendChild(el("div", { class: "carte carte-corps", style: "padding:8px" }, [
          el("div", { class: "rangee gap-2 rangee-wrap" }, [nom, del]),
          el("div", { class: "rangee gap-2 rangee-wrap mt-1" }, [series, reps, repos, note]),
        ]));
      });
    }
    rendre();
    CL.modal.ouvrir({
      titre: "Programme d'entraînement — " + a.clientNom,
      large: true,
      contenu: el("div", { class: "pile-3" }, [
        el("p", { class: "texte-sm texte-doux", text: "Détaillez les exercices (séries, répétitions, repos). Le client les verra dans son abonnement." }),
        liste,
        el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("plus", 15) + " Ajouter un exercice", onclick: () => { exos.push({ nom: "", series: "", repetitions: "", repos: "", note: "" }); rendre(); } }),
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", text: "Enregistrer le programme", onclick: async (e) => {
          const nettoye = exos.filter((x) => (x.nom || "").trim()).map((x) => ({ nom: x.nom.trim(), series: x.series || "", repetitions: x.repetitions || "", repos: x.repos || "", note: x.note || "" }));
          e.currentTarget.disabled = true;
          await abonnementService.definirExercices(a.id, nettoye);
          CL.modal.fermer(); CL.toast.succes("Programme enregistré 💪", "Le client a été notifié."); onChange && onChange();
        } }),
      ],
    });
  }

  /* Coach : valide UNE séance d'abonnement (QR rotatif du client → décompte). */
  function validerSeanceCoach(a, onChange) {
    CL.scanQr.modal({
      titre: "Valider une séance — " + a.clientNom,
      phrase: "Scannez le QR de présence du client (ou saisissez son code à 6 chiffres) pour comptabiliser cette séance. La mensualité sera créditée à votre portefeuille une fois toutes les séances du mois validées.",
      boutonValider: "Valider la séance",
      onValider: (valeur) => abonnementService.validerSeance(a.id, valeur),
      onSucces: (res) => {
        if (res.libere) CL.toast.succes("Mois complet ✅", "Toutes les séances validées : mensualité créditée à votre portefeuille.");
        else CL.toast.succes("Séance validée ✅", "Séances du mois : " + res.validees + " / " + res.prevues + ".");
        onChange && onChange();
      },
    });
  }

  /* ------------- Coach : construit le programme + le prix --------- */
  function ouvrirProgramme(a, onChange) {
    const prog = JSON.parse(JSON.stringify(a.programme || {}));
    format.JOURS_COURTS.forEach((j) => { if (!prog[j]) prog[j] = []; });
    const coach = CL.coachCourant();
    const dispo = (coach && coach.disponibilites) || {};

    const compteur = el("div", { class: "texte-sm gras mb-2" });
    function majCompteur() {
      const n = format.JOURS_COURTS.reduce((s, j) => s + prog[j].length, 0);
      compteur.textContent = n + " séance(s) placée(s) — objectif : " + a.seancesSemaine + "/semaine";
    }
    const grille = el("div", { class: "calendrier__grille" });
    function rendreGrille() {
      CL.dom.vider(grille);
      grille.appendChild(el("div", { class: "calendrier__entete" }));
      format.JOURS_COURTS.forEach((j) => grille.appendChild(el("div", { class: "calendrier__entete", text: j })));
      HEURES.forEach((h) => {
        grille.appendChild(el("div", { class: "calendrier__heure", text: h }));
        format.JOURS_COURTS.forEach((j) => {
          const choisi = prog[j].includes(h);
          const dispoJour = (dispo[j] || []).includes(h);
          const cell = el("div", { class: "creneau " + (choisi ? "libre choisi" : (dispoJour ? "libre" : "occupe")), text: choisi ? "✓" : (dispoJour ? "Dispo" : "—"), style: "cursor:pointer" });
          cell.addEventListener("click", () => {
            if (prog[j].includes(h)) prog[j] = prog[j].filter((x) => x !== h);
            else prog[j].push(h);
            rendreGrille(); majCompteur();
          });
          grille.appendChild(cell);
        });
      });
    }
    rendreGrille(); majCompteur();

    const prixSeance = el("input", { class: "input", type: "number", min: "0", step: "500", value: String(a.prixSeance || coachService.prixMin(coach) || 10000) });
    const estim = el("div", { class: "texte-sm gras mt-1" });
    function majEstim() {
      const n = format.JOURS_COURTS.reduce((s, j) => s + prog[j].length, 0) || a.seancesSemaine;
      estim.textContent = "≈ " + format.fcfa((Number(prixSeance.value) || 0) * n * 4) + " / mois";
    }
    prixSeance.addEventListener("input", majEstim); majEstim();

    CL.modal.ouvrir({
      titre: "Programme mensuel — " + a.clientNom,
      contenu: el("div", { class: "pile-4" }, [
        el("div", { class: "carte carte-corps", style: "background:var(--surface-2)" }, [
          el("div", { class: "texte-sm", text: "Objectif : " + a.objectif }),
          el("div", { class: "texte-sm", html: CL.icon("localisation", 13) + " " + CL.profilCat.lieu(a.lieuType).label + (CL.localisation.resume(a) ? " — " + CL.localisation.resume(a) : "") }),
        ]),
        el("div", {}, [el("label", { class: "champ", style: "font-weight:600;display:block;margin-bottom:6px", text: "Créneaux hebdomadaires (cliquez pour placer les séances)" }), compteur, el("div", { class: "calendrier" }, [grille])]),
        champ("Prix par séance (FCFA)", prixSeance), estim,
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", text: "Proposer au client", onclick: async (e) => {
          const n = format.JOURS_COURTS.reduce((s, j) => s + prog[j].length, 0);
          if (!n) return CL.toast.erreur("Programme vide", "Placez au moins une séance.");
          e.currentTarget.disabled = true;
          const nettoye = {}; format.JOURS_COURTS.forEach((j) => { if (prog[j].length) nettoye[j] = prog[j].sort(); });
          try {
            await abonnementService.definirProgramme(a.id, { programme: nettoye, seancesSemaine: n, prixSeance: Number(prixSeance.value) || 0, lieuNom: a.lieuNom });
            CL.modal.fermer(); CL.toast.succes("Programme proposé ✅", "Le client a été notifié."); onChange && onChange();
          } catch (err) { e.currentTarget.disabled = false; CL.toast.erreur("Échec", (err && err.message) || ""); }
        } }),
      ],
    });
  }

  /* ------------- Client : règlement mensuel (Mobile Money) -------- */
  function payerMois(a) {
    let operateur = bookingService.OPERATEURS[0].id;
    const ops = el("div", { class: "rangee gap-2 rangee-wrap" }, bookingService.OPERATEURS.map((o, i) => {
      const b = el("button", { class: "chip" + (i === 0 ? " actif" : ""), type: "button", text: o.nom });
      b.addEventListener("click", () => { operateur = o.id; ops.querySelectorAll(".chip").forEach((x) => x.classList.remove("actif")); b.classList.add("actif"); });
      return b;
    }));
    const numero = el("input", { class: "input", placeholder: "Numéro Mobile Money (07/05/01)" });
    const code = el("input", { class: "input", placeholder: "Code de confirmation (4 chiffres)", maxlength: "4" });

    CL.modal.ouvrir({
      titre: "Régler le mois — " + format.fcfa(a.prixMensuel),
      contenu: el("div", { class: "pile-3" }, [
        el("p", { class: "texte-sm texte-doux", text: "Abonnement mensuel avec " + a.coachNom + " (" + abonnementService.moisCourant() + ")." }),
        el("div", {}, [el("label", { class: "champ", style: "display:block;margin-bottom:6px", text: "Opérateur" }), ops]),
        champ("Numéro", numero), champ("Code", code),
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-succes", text: "Payer " + format.fcfa(a.prixMensuel), onclick: async (e) => {
          const op = bookingService.OPERATEURS.find((o) => o.id === operateur);
          if (op.prefixe && !CL.validation.telephoneCI(numero.value)) return CL.toast.erreur("Numéro invalide", "Format CI attendu (07/05/01).");
          e.currentTarget.disabled = true;
          const res = await abonnementService.payer(a.id, { operateur: op.nom, numero: numero.value.trim(), code: code.value.trim() });
          if (!res.ok) { e.currentTarget.disabled = false; return CL.toast.erreur("Paiement refusé", res.message); }
          CL.modal.fermer();
          if (res.enAttente) { CL.toast.info("Paiement initié 📲", res.message); }
          else CL.toast.succes("Paiement réussi 🎉", "Abonnement réglé pour " + abonnementService.moisCourant() + ".");
          CL.router.rendre();
        } }),
      ],
    });
  }
})();

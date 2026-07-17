/* ==========================================================================
   pages/client.js — Espace client : tableau de bord, réservations, favoris,
   avis à laisser. Utilise le shell "dash" (sidebar).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { auth, bookingService, coachService, ui, format } = CL;

  /* -------------------------- Tableau de bord ---------------------- */
  CL.pages.clientAccueil = function () {
    const u = auth.courant();
    const resas = bookingService.parClient(u.id);
    const aVenir = resas.filter((r) => r.statut === "confirmee").length;
    const aEvaluer = bookingService.aEvaluer(u.id).length;
    const st = CL.insights ? CL.insights.statsClient(u.id) : { seancesRealisees: 0, totalInvesti: 0, coachsSuivis: 0, abonnementsActifs: 0 };
    const rdv = CL.insights ? CL.insights.prochainRendezVous("client", { clientId: u.id }) : null;

    const page = el("div", {}, [
      enteteBienvenue(u, "Voici un aperçu de votre accompagnement."),
      el("div", { class: "grille grille-4 mb-5" }, [
        statCarte("calendrier", "var(--bleu-confiance)", aVenir, "Séances à venir"),
        statCarte("etoile", "var(--jaune-etoile)", st.seancesRealisees, "Séances réalisées"),
        statCarte("portefeuille", "var(--vert-validation)", format.fcfa(st.totalInvesti).replace(" FCFA", ""), "Total investi (FCFA)"),
        statCarte("utilisateur", "var(--orange-cta)", st.coachsSuivis, "Coachs suivis"),
      ]),
    ]);

    // Prochaine séance (mise en avant).
    if (rdv) page.appendChild(carteProchainRdv(rdv, "#/client/reservations"));

    // Ma progression : abonnements actifs (séances validées / prévues du mois).
    const abosActifs = (CL.abonnementService ? CL.abonnementService.parClient(u.id) : []).filter((a) => a.statut === "actif");
    if (abosActifs.length) {
      page.appendChild(el("h3", { class: "mt-5 mb-3", text: "Ma progression ce mois" }));
      page.appendChild(el("div", { class: "pile-3" }, abosActifs.map((a) => carteProgression(a))));
    }

    if (aEvaluer > 0) {
      page.appendChild(el("div", { class: "carte carte-corps mb-5", style: "border-left:4px solid var(--orange-cta)" }, [
        el("div", { class: "rangee entre rangee-wrap gap-3" }, [
          el("div", {}, [el("strong", { html: CL.icon("etoile", 18) + " Vous avez " + aEvaluer + " séance(s) à évaluer" }), el("p", { class: "texte-sm", text: "Votre avis aide les autres clients à choisir." })]),
          el("a", { class: "btn btn-cta", href: "#/client/avis", text: "Laisser un avis" }),
        ]),
      ]));
    }

    // Prochaines réservations
    page.appendChild(el("div", { class: "rangee entre mb-3" }, [el("h3", { text: "Réservations récentes" }), el("a", { class: "btn-lien", href: "#/client/reservations", text: "Tout voir" })]));
    const recentes = resas.slice(0, 3);
    page.appendChild(recentes.length ? el("div", { class: "pile-3" }, recentes.map((r) => carteReservation(r, "client"))) : ui.vide("calendrier", "Aucune réservation", "Trouvez un coach et réservez votre première séance."));

    // Suggestions
    page.appendChild(el("h3", { class: "mt-5 mb-3", text: "Coachs recommandés pour vous" }));
    page.appendChild(el("div", { class: "grille grille-coachs" }, coachService.populaires(3).map((c) => CL.coachCard(c))));
    return page;
  };

  /* ---------------------------- Réservations ---------------------- */
  CL.pages.clientReservations = function () {
    const u = auth.courant();
    let filtre = "toutes";
    const liste = el("div", { class: "pile-3" });

    function rendre() {
      let resas = bookingService.parClient(u.id);
      if (filtre !== "toutes") resas = resas.filter((r) => r.statut === filtre);
      CL.dom.vider(liste);
      if (!resas.length) { liste.appendChild(ui.vide("calendrier", "Aucune réservation", "Vos réservations apparaîtront ici.")); return; }
      resas.forEach((r) => liste.appendChild(carteReservation(r, "client", rendre)));
    }

    const filtres = el("div", { class: "onglets mb-4" }, [
      ["toutes", "Toutes"], ["en_attente", "En attente"], ["confirmee", "Confirmées"], ["terminee", "Terminées"], ["annulee", "Annulées"],
    ].map(([cle, label], i) => {
      const o = el("button", { class: "onglet" + (i === 0 ? " actif" : ""), text: label });
      o.addEventListener("click", () => { filtre = cle; filtres.querySelectorAll(".onglet").forEach((x) => x.classList.remove("actif")); o.classList.add("actif"); rendre(); });
      return o;
    }));

    rendre();
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes réservations" }), el("p", { text: "Suivez l'état de vos séances." })])]), filtres, liste]);
  };

  /* ------------------------------ Favoris ------------------------- */
  CL.pages.clientFavoris = function () {
    const ids = coachService.favoris();
    const coachs = ids.map((id) => coachService.obtenir(id)).filter(Boolean);
    const grille = coachs.length
      ? el("div", { class: "grille grille-coachs" }, coachs.map((c) => CL.coachCard(c)))
      : ui.vide("coeur", "Aucun favori", "Ajoutez des coachs à vos favoris pour les retrouver ici.");
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes favoris" }), el("p", { text: coachs.length + " coach(s) enregistré(s)." })])]), grille]);
  };

  /* -------------------------------- Avis -------------------------- */
  CL.pages.clientAvis = function () {
    const u = auth.courant();
    const aEvaluer = bookingService.aEvaluer(u.id);
    const page = el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes avis" }), el("p", { text: "Évaluez vos séances terminées." })])])]);

    if (!aEvaluer.length) {
      page.appendChild(ui.vide("etoile", "Rien à évaluer", "Vous avez évalué toutes vos séances terminées. Merci !"));
      return page;
    }
    page.appendChild(el("div", { class: "pile-3" }, aEvaluer.map((r) => {
      const coach = coachService.obtenir(r.coachId);
      return el("div", { class: "carte carte-corps rangee entre rangee-wrap gap-3" }, [
        el("div", { class: "rangee gap-3" }, [coach ? ui.avatarCoach(coach, "avatar-md") : null, el("div", {}, [el("strong", { text: r.tarifNom }), el("div", { class: "texte-sm texte-doux", text: coach ? coachService.nomComplet(coach) : "" }), el("div", { class: "texte-xs texte-faible", text: r.jour + " à " + r.heure })])]),
        el("button", { class: "btn btn-cta", html: CL.icon("etoile", 18) + " Évaluer", onclick: () => coach && CL.ouvrirAvis(coach, r) }),
      ]);
    })));
    return page;
  };

  /* --------------------------- Composants ------------------------- */
  /** Ouvre une réclamation (litige) sur une prestation. */
  function signalerLitige(r, coach) {
    const u = auth.courant();
    const motif = el("textarea", { class: "textarea", rows: "3", placeholder: "Décrivez le problème rencontré (séance non honorée, remboursement…)." });
    CL.modal.ouvrir({
      titre: "Signaler un problème",
      contenu: el("div", { class: "pile-3" }, [
        el("p", { class: "texte-sm texte-doux", text: "Prestation « " + r.tarifNom + " » avec " + coachService.nomComplet(coach) + "." }),
        motif,
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", text: "Envoyer la réclamation", onclick: () => {
          if (!motif.value.trim()) return CL.toast.erreur("Motif requis", "Décrivez le problème.");
          CL.litiges.ouvrir({ client: u.prenom + " " + u.nom, coach: coachService.nomComplet(coach), motif: motif.value.trim() });
          CL.modal.fermer();
          CL.toast.succes("Réclamation envoyée", "Notre équipe va l'examiner.");
        } }),
      ],
    });
  }

  // QR de présence rotatif (réutilisable) : le client le présente au coach ; le
  // coach le scanne (ou saisit le code) pour valider la séance. Le code se
  // régénère toutes les 30 s ; le secret n'est jamais affiché.
  function montrerQrPresence(secret, titre, phrase) {
    const zoneQr = el("div", { style: "display:flex;justify-content:center;align-items:center;min-height:230px" });
    const codeAff = el("div", { class: "badge badge-neutre", style: "font-family:monospace;font-size:1.5rem;letter-spacing:4px" });
    const compte = el("div", { class: "texte-xs texte-faible" });
    let fenetreAff = null;

    function rendre() {
      if (!CL.otp) { zoneQr.innerHTML = CL.qrcode ? CL.qrcode.svg(secret, { size: 230 }) : ""; return; }
      const et = CL.otp.courant(secret);
      if (et.fenetre !== fenetreAff) { // nouvelle fenêtre → nouveau QR + nouveau code
        fenetreAff = et.fenetre;
        zoneQr.innerHTML = CL.qrcode ? CL.qrcode.svg(et.payload, { size: 230 }) : "";
        codeAff.textContent = et.code;
      }
      compte.textContent = "Nouveau code dans " + et.resteSec + " s";
    }
    rendre();
    const timer = setInterval(() => { if (!zoneQr.isConnected) { clearInterval(timer); return; } rendre(); }, 1000);

    CL.modal.ouvrir({
      titre: titre || "Mon QR de présence",
      contenu: el("div", { class: "pile-3 texte-centre" }, [
        phrase ? el("p", { class: "texte-sm texte-doux", text: phrase }) : null,
        zoneQr,
        codeAff,
        compte,
        el("p", { class: "texte-xs texte-faible", html: CL.icon("bouclier", 13) + " Code sécurisé : il se régénère automatiquement toutes les 30 secondes." }),
      ]),
      pied: [el("button", { class: "btn btn-primaire", text: "Fermer", onclick: CL.modal.fermer })],
    });
  }
  CL.montrerQrPresence = montrerQrPresence;

  // Ligne « lieu » d'une réservation (selon la catégorie : cabinet, domicile,
  // salle, studio, bureau convenu ou visioconférence).
  function ligneLieu(r) {
    if (!r || !r.lieuType) return null;
    const cfg = CL.profilCat.lieu(r.lieuType);
    const detail = cfg.enLigne ? "" : (cfg.adresse ? (CL.localisation.resume(r) || "") : "");
    const txt = cfg.label + (detail ? " — " + detail : "");
    const bloc = el("div", { class: "texte-xs texte-faible", html: CL.icon("localisation", 13) + " " + txt });
    if ((r.lat && r.lng) || r.adresse) {
      bloc.appendChild(document.createTextNode(" · "));
      bloc.appendChild(el("a", { class: "btn-lien", href: CL.localisation.lienMaps(r), target: "_blank", rel: "noopener", text: "Google Maps" }));
    }
    return bloc;
  }

  function carteReservation(r, vue, onChange) {
    const coach = coachService.obtenir(r.coachId);
    const st = bookingService.STATUTS[r.statut];
    const actions = el("div", { class: "rangee gap-2 rangee-wrap" });

    if (vue === "client") {
      if (r.statut === "en_attente" && !r.paiement) {
        actions.appendChild(el("span", { class: "badge badge-neutre", text: "Paiement à finaliser" }));
      }
      if (r.statut === "en_attente" || r.statut === "confirmee") {
        actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", text: "Annuler", onclick: () => { bookingService.changerStatut(r.id, "annulee"); CL.toast.info("Annulée", ""); onChange ? onChange() : CL.router.rendre(); } }));
      }
      if (r.statut === "confirmee" && r.jeton && !r.presenceValidee) {
        actions.appendChild(el("button", { class: "btn btn-cta btn-sm", html: CL.icon("qrcode", 15) + " Mon QR de présence", onclick: () => montrerQrPresence(r.jeton, "Mon QR de présence", "Présentez ce QR code (ou dictez le code) à votre coach à la fin de la séance « " + r.tarifNom + " » pour confirmer votre présence.") }));
      }
      if (r.statut === "terminee" && !r.avisLaisse && coach) {
        actions.appendChild(el("button", { class: "btn btn-cta btn-sm", text: "Laisser un avis", onclick: () => CL.ouvrirAvis(coach, r) }));
      }
      if ((r.statut === "confirmee" || r.statut === "terminee") && coach) {
        actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("bouclier", 14) + " Signaler", onclick: () => signalerLitige(r, coach) }));
      }
      if (coach) actions.appendChild(el("a", { class: "btn btn-primaire btn-sm", href: "#/coach/" + coach.id, text: "Voir le coach" }));
    }

    return el("div", { class: "carte carte-corps" }, [
      el("div", { class: "rangee entre rangee-wrap gap-3" }, [
        el("div", { class: "rangee gap-3" }, [
          coach ? ui.avatarCoach(coach, "avatar-md") : ui.avatarNom(r.clientNom, "avatar-md"),
          el("div", {}, [
            el("strong", { text: r.tarifNom }),
            el("div", { class: "texte-sm texte-doux", text: coach ? coachService.nomComplet(coach) : r.clientNom }),
            el("div", { class: "texte-xs texte-faible", html: CL.icon("calendrier", 13) + " " + r.jour + " à " + r.heure + " · " + format.fcfa(r.prix) }),
            ligneLieu(r),
          ]),
        ]),
        el("div", { class: "pile", style: "align-items:flex-end;gap:8px" }, [
          el("span", { class: "pastille-statut " + st.classe, text: st.label }),
          r.paiement ? el("span", { class: "texte-xs texte-faible", text: "Réf " + r.paiement.reference }) : null,
        ]),
      ]),
      actions.children.length ? el("div", { class: "mt-3", style: "border-top:1px solid var(--bordure);padding-top:12px" }, [actions]) : null,
    ]);
  }
  CL.carteReservation = carteReservation;

  // Carte « prochaine séance » (partagée client/coach).
  function carteProchainRdv(rdv, lienHref) {
    const lieu = (CL.profilCat && rdv.lieuType) ? CL.profilCat.lieu(rdv.lieuType).label : "";
    return el("div", { class: "carte carte-corps mb-5", style: "border-left:4px solid var(--bleu-confiance);background:var(--bleu-confiance-clair)" }, [
      el("div", { class: "rangee entre rangee-wrap gap-3" }, [
        el("div", {}, [
          el("div", { class: "texte-xs texte-faible", html: CL.icon("calendrier", 14) + " Prochaine séance" }),
          el("strong", { style: "font-size:var(--fs-lg)", text: CL.insights.libelleQuand(rdv.occ) }),
          el("div", { class: "texte-sm texte-doux", text: rdv.sous + " · avec " + rdv.avec + (lieu ? " · " + lieu : "") }),
        ]),
        el("a", { class: "btn btn-primaire", href: lienHref, text: "Voir" }),
      ]),
    ]);
  }
  CL.carteProchainRdv = carteProchainRdv;

  // Carte de progression d'un abonnement (barre séances validées / prévues).
  function carteProgression(a) {
    const pr = CL.abonnementService.progresMois(a);
    const pct = Math.round((100 * pr.validees) / Math.max(1, pr.prevues));
    return el("div", { class: "carte carte-corps" }, [
      el("div", { class: "rangee entre rangee-wrap gap-2" }, [
        el("strong", { text: a.objectif + " — " + a.coachNom }),
        el("span", { class: "texte-sm texte-doux", text: pr.validees + " / " + pr.prevues + " séances" }),
      ]),
      el("div", { style: "height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-top:8px" }, [
        el("div", { style: "height:100%;width:" + pct + "%;background:" + (pr.libere ? "var(--vert-validation)" : "var(--bleu-confiance)") }),
      ]),
      el("div", { class: "texte-xs texte-faible mt-1", text: pr.libere ? "Mois complet ✓" : "Présentez votre QR à chaque séance pour valider votre progression." }),
    ]);
  }
  CL.carteProgression = carteProgression;

  function statCarte(icone, couleur, valeur, label) {
    return el("div", { class: "carte stat-carte" }, [
      el("div", { class: "stat-carte__icone", style: `background:${couleur}1a;color:${couleur}`, html: CL.icon(icone, 22, { fill: icone === "etoile" || icone === "coeur" }) }),
      el("div", { class: "stat-carte__valeur", text: String(valeur) }),
      el("div", { class: "stat-carte__label", text: label }),
    ]);
  }
  CL.statCarte = statCarte;

  function enteteBienvenue(u, sousTitre) {
    return el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Bonjour, " + u.prenom + " 👋" }), el("p", { text: sousTitre })])]);
  }
  CL.enteteBienvenue = enteteBienvenue;
})();

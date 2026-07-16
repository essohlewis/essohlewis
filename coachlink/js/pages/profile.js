/* ==========================================================================
   pages/profile.js — Profil public d'un coach : couverture, TrustScore,
   badges, onglets (à propos, tarifs, mur, avis, disponibilités), diplômes,
   partage social + Open Graph, réservation (calendrier) + paiement simulé,
   contact messagerie.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, esc } = CL.dom;
  const { coachService, ui, format, auth, bookingService } = CL;

  CL.pages.profilCoach = function (params) {
    const coach = coachService.obtenir(params.coachId);
    if (!coach) return ui.vide("utilisateur", "Coach introuvable", "Ce profil n'existe pas ou a été supprimé.");

    const nom = coachService.nomComplet(coach);
    const trust = coachService.trustScore(coach);

    // Open Graph dynamique pour un partage riche.
    CL.socialService.majOpenGraph({
      titre: nom + " — " + coach.titre,
      description: format.tronquer(coach.bio, 140),
      type: "profile",
      url: CL.socialService.lienProfil(coach.id),
    });

    /* --------------------------- En-tête ---------------------------- */
    const estFav = coachService.estFavori(coach.id);
    const btnFav = el("button", { class: "btn btn-fantome", html: CL.icon("coeur", 18, { fill: estFav }) + (estFav ? " Favori" : " Ajouter aux favoris") });
    btnFav.addEventListener("click", () => {
      if (!auth.estConnecte()) { CL.toast.info("Connexion requise", ""); location.hash = "#/connexion"; return; }
      const actif = coachService.basculerFavori(coach.id);
      btnFav.innerHTML = CL.icon("coeur", 18, { fill: actif }) + (actif ? " Favori" : " Ajouter aux favoris");
      CL.toast.succes(actif ? "Ajouté aux favoris" : "Retiré", nom);
    });

    const entete = el("div", {}, [
      el("div", { class: "profil-couverture", style: `background:linear-gradient(120deg, ${coach.couleur}, #3b6fe6, var(--orange-cta))` }),
      el("div", { class: "profil-entete" }, [
        ui.avatarCoach(coach, "profil-entete__avatar"),
        el("div", { class: "profil-entete__info" }, [
          el("h1", { class: "profil-entete__nom" }, [
            document.createTextNode(nom),
            coachService.badges(coach).some((b) => b.cle === "verifie") ? el("span", { class: "puce-verifie", title: "Vérifié", html: CL.icon("verifie", 24, { fill: true }) }) : null,
          ]),
          el("p", { class: "texte-doux", text: coach.titre }),
          el("div", { class: "rangee rangee-wrap gap-2 mt-2" }, [
            el("span", { class: "rangee gap-2 texte-sm texte-doux", html: CL.icon("localisation", 16) + " " + esc(coach.commune) + ", " + esc(coach.ville) }),
            el("span", { class: "rangee gap-2 texte-sm texte-doux", html: CL.icon("globe", 16) + " " + esc(coach.langues.join(", ")) }),
          ]),
          ui.badges(coach),
        ]),
      ]),
    ]);

    /* --------------------------- Actions ---------------------------- */
    const actions = el("div", { class: "rangee rangee-wrap gap-2 mt-4 profil-actions", style: "padding:0 var(--e-5)" }, [
      el("button", { class: "btn btn-cta btn-lg", html: CL.icon("calendrier", 18) + " Réserver une séance", onclick: () => ouvrirReservation(coach) }),
      el("button", { class: "btn btn-primaire", html: CL.icon("message", 18) + " Contacter", onclick: () => contacter(coach) }),
      btnFav,
      el("button", { class: "btn btn-fantome", html: CL.icon("partager", 18) + " Partager", onclick: () => ouvrirPartage(coach) }),
    ]);

    /* ------------------------- Stats + Trust ------------------------ */
    const colDroite = el("div", { class: "pile-5" }, [
      el("div", { class: "carte carte-corps" }, [
        el("h4", { class: "mb-3", text: "Indice de confiance" }),
        el("div", { class: "trustscore" }, [
          jaugeTrust(trust),
          el("div", {}, [
            el("strong", { style: "font-size:var(--fs-lg)", text: "TrustScore : " + trust + "/100" }),
            el("p", { class: "texte-sm", text: "Calculé sur les diplômes vérifiés, les avis, l'ancienneté et la réactivité." }),
          ]),
        ]),
        el("div", { class: "profil-stats mt-4" }, [
          stat(format.note(coach.note), "Note (" + coach.nbAvis + " avis)"),
          stat(coach.nbSeances, "Séances"),
          stat(coach.tauxReponse + "%", "Réponses"),
        ]),
      ]),
      cartePartage(coach),
      el("div", { class: "carte carte-corps" }, [
        el("h4", { class: "mb-3", text: "Contact" }),
        el("div", { class: "pile-2 texte-sm" }, [
          el("div", { class: "rangee gap-2", html: CL.icon("telephone", 16) + " " + esc(coach.telephone) }),
          el("div", { class: "rangee gap-2", html: CL.icon("mail", 16) + " " + esc(coach.email) }),
        ]),
      ]),
    ]);

    /* ---------------------------- Onglets --------------------------- */
    const contenuOnglet = el("div", { class: "mt-4" });
    const onglets = [
      ["apropos", "À propos"],
      ["tarifs", "Tarifs"],
      ["mur", "Mur (" + (coach.posts || []).length + ")"],
      ["avis", "Avis (" + (coach.avis || []).length + ")"],
      ["dispo", "Disponibilités"],
    ];
    const barreOnglets = el("div", { class: "onglets onglets--sticky" }, onglets.map(([cle, label], i) => {
      const o = el("button", { class: "onglet" + (i === 0 ? " actif" : ""), text: label, "data-onglet": cle });
      o.addEventListener("click", () => {
        barreOnglets.querySelectorAll(".onglet").forEach((x) => x.classList.remove("actif"));
        o.classList.add("actif");
        rendreOnglet(cle);
      });
      return o;
    }));

    function rendreOnglet(cle) {
      CL.dom.vider(contenuOnglet);
      if (cle === "apropos") contenuOnglet.appendChild(ongletApropos(coach));
      else if (cle === "tarifs") contenuOnglet.appendChild(ongletTarifs(coach));
      else if (cle === "mur") contenuOnglet.appendChild(ongletMur(coach));
      else if (cle === "avis") contenuOnglet.appendChild(ongletAvis(coach));
      else if (cle === "dispo") contenuOnglet.appendChild(calendrierDispo(coach, (jour, heure) => ouvrirReservation(coach, jour, heure)));
    }
    rendreOnglet("apropos");

    return el("div", { class: "contenu--large" }, [
      el("a", { class: "btn-lien mb-2", href: "#/recherche", html: CL.icon("fleche_gauche", 16) + " Retour à la recherche" }),
      el("div", { class: "carte", style: "overflow:hidden;padding-bottom:var(--e-5)" }, [entete, actions]),
      el("div", { class: "deux-colonnes mt-5" }, [
        el("div", {}, [barreOnglets, contenuOnglet]),
        colDroite,
      ]),
    ]);
  };

  /* ========================== ONGLETS ============================== */
  function ongletApropos(coach) {
    return el("div", { class: "pile-5" }, [
      el("div", { class: "carte carte-corps" }, [
        el("h3", { class: "mb-3", text: "Présentation" }),
        el("p", { style: "color:var(--texte); line-height:1.7", text: coach.bio }),
        el("h4", { class: "mt-5 mb-2", text: "Spécialités" }),
        ui.chipsSpecialites(coach.specialites),
      ]),
      cartesDiplomes(coach),
    ]);
  }

  function cartesDiplomes(coach) {
    const liste = coach.diplomes || [];
    return el("div", { class: "carte carte-corps" }, [
      el("h3", { class: "mb-3", html: CL.icon("diplome", 20) + " Diplômes & certifications" }),
      liste.length ? el("div", { class: "pile-3" }, liste.map((d) => el("div", { class: "diplome-item" }, [
        el("div", { class: "diplome-item__vignette", html: CL.icon("diplome", 22) }),
        el("div", { style: "flex:1" }, [
          el("strong", { text: d.titre }),
          el("div", { class: "texte-sm texte-doux", text: d.ecole + " · " + d.annee }),
        ]),
        d.statut === "verifie"
          ? el("span", { class: "badge badge-verifie", html: CL.icon("verifie", 13, { fill: true }) + " Vérifié" })
          : el("span", { class: "badge badge-neutre", text: "En attente" }),
      ]))) : el("p", { class: "texte-doux", text: "Aucun diplôme renseigné." }),
    ]);
  }

  function ongletTarifs(coach) {
    return el("div", { class: "grille grille-3" }, (coach.tarifs || []).map((t, i) => {
      const populaire = i === 1 || (coach.tarifs.length === 1);
      return el("div", { class: "tarif-carte" + (populaire ? " populaire" : "") }, [
        populaire ? el("div", { class: "ruban-populaire", text: "Populaire" }) : null,
        el("span", { class: "badge badge-neutre mb-2", text: ({ seance: "Séance", pack: "Pack", abonnement: "Abonnement" })[t.type] || t.type }),
        el("h4", { text: t.nom }),
        el("div", { class: "tarif-carte__prix mt-2" }, [document.createTextNode(format.fcfa(t.prix).replace(" FCFA", "")), el("small", { text: " FCFA" })]),
        el("div", { class: "texte-sm texte-faible", html: CL.icon("horloge", 14) + " " + t.duree + " min" }),
        el("p", { class: "texte-sm mt-3", text: t.description || "" }),
        el("button", { class: "btn " + (populaire ? "btn-cta" : "btn-primaire") + " btn-bloc mt-4", text: "Réserver", onclick: () => ouvrirReservation(coach, null, null, t.id) }),
      ]);
    }));
  }

  function ongletMur(coach) {
    const posts = coach.posts || [];
    if (!posts.length) return ui.vide("document", "Aucune publication", nomCoach(coach) + " n'a pas encore publié.");
    return el("div", { class: "pile-4" }, posts.map((p) => cartePost(coach, p)));
  }

  function cartePost(coach, p) {
    const carte = el("article", { class: "carte post" }, [
      el("div", { class: "post__entete" }, [
        ui.avatarCoach(coach, "avatar-sm"),
        el("div", {}, [el("strong", { text: nomCoach(coach) }), el("div", { class: "texte-xs texte-faible", text: format.tempsRelatif(p.date) })]),
      ]),
      el("p", { style: "color:var(--texte)", text: p.texte }),
      p.image ? el("div", { class: "post__media" }, [el("img", { src: p.image, alt: "Publication" })]) : null,
      el("div", { class: "post__actions" }, [
        (function () {
          const b = el("button", { html: CL.icon("pouce", 16) + " " + '<span>' + p.likes + "</span>" });
          b.addEventListener("click", () => {
            const n = coachService.aimerPost(coach.id, p.id);
            b.querySelector("span").textContent = n;
          });
          return b;
        })(),
        el("button", { html: CL.icon("message", 16) + " Commenter" }),
        el("button", { html: CL.icon("partager", 16) + " Partager" }),
      ]),
    ]);
    return carte;
  }

  function ongletAvis(coach) {
    const avis = coach.avis || [];
    const moyenne = coach.note || 0;
    const entete = el("div", { class: "carte carte-corps mb-4 rangee gap-4 rangee-wrap" }, [
      el("div", { class: "texte-centre" }, [
        el("div", { style: "font-size:var(--fs-4xl);font-weight:800;line-height:1", text: format.note(moyenne) }),
        ui.etoiles(moyenne, { grand: true }),
        el("div", { class: "texte-sm texte-faible mt-2", text: coach.nbAvis + " avis" }),
      ]),
      el("div", { style: "flex:1;min-width:200px" }, repartitionNotes(avis)),
    ]);

    // Bouton laisser un avis si le client a une séance terminée.
    const u = auth.courant();
    let btnAvis = null;
    if (u && u.role === "client") {
      const eligibles = bookingService.aEvaluer(u.id).filter((b) => b.coachId === coach.id);
      if (eligibles.length) {
        btnAvis = el("button", { class: "btn btn-cta mb-4", html: CL.icon("etoile", 18) + " Laisser un avis", onclick: () => ouvrirAvis(coach, eligibles[0]) });
      }
    }

    const listeEl = avis.length
      ? el("div", { class: "carte carte-corps" }, avis.map((a) => avisItem(coach, a)))
      : ui.vide("etoile", "Aucun avis", "Soyez le premier à évaluer ce coach après une séance.");

    return el("div", {}, [entete, btnAvis, listeEl]);
  }

  function avisItem(coach, a) {
    return el("div", { class: "avis-item" }, [
      el("div", { class: "rangee entre" }, [
        el("div", { class: "rangee gap-2" }, [ui.avatarNom(a.auteur, "avatar-sm", "#475569"), el("div", {}, [el("strong", { text: a.auteur }), el("div", { class: "texte-xs texte-faible", text: format.date(a.date) })])]),
        ui.etoiles(a.note),
      ]),
      el("p", { class: "mt-2", style: "color:var(--texte)", text: a.texte }),
      a.reponse ? el("div", { class: "avis-reponse" }, [el("strong", { class: "texte-sm", html: CL.icon("message", 14) + " Réponse de " + esc(nomCoach(coach)) }), el("p", { class: "texte-sm mt-2", text: a.reponse })]) : null,
    ]);
  }

  function repartitionNotes(avis) {
    const cont = el("div", { class: "pile-2" });
    for (let n = 5; n >= 1; n--) {
      const nb = avis.filter((a) => a.note === n).length;
      const pct = avis.length ? Math.round((nb / avis.length) * 100) : 0;
      cont.appendChild(el("div", { class: "rangee gap-2 texte-sm" }, [
        el("span", { style: "width:12px", text: String(n) }),
        el("span", { html: CL.icon("etoile", 14, { fill: true }), style: "color:var(--jaune-etoile)" }),
        el("div", { style: "flex:1;height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden" }, [
          el("div", { style: `width:${pct}%;height:100%;background:var(--jaune-etoile)` }),
        ]),
        el("span", { class: "texte-faible", style: "width:32px;text-align:right", text: String(nb) }),
      ]));
    }
    return cont;
  }

  /* ======================= CALENDRIER DISPO ======================== */
  function calendrierDispo(coach, onCreneau, choixEtat) {
    const heures = ["08:00", "09:00", "10:00", "11:00", "16:00", "17:00", "18:00", "19:00"];
    const jours = format.JOURS_COURTS;
    const grille = el("div", { class: "calendrier__grille" });
    // En-tête
    grille.appendChild(el("div", { class: "calendrier__entete", text: "" }));
    jours.forEach((j) => grille.appendChild(el("div", { class: "calendrier__entete", text: j })));
    // Lignes
    heures.forEach((h) => {
      grille.appendChild(el("div", { class: "calendrier__heure", text: h }));
      jours.forEach((j) => {
        const libre = (coach.disponibilites[j] || []).includes(h);
        const cell = el("div", { class: "creneau " + (libre ? "libre" : "occupe"), text: libre ? "Libre" : "—" });
        if (libre && onCreneau) {
          if (choixEtat && choixEtat.jour === j && choixEtat.heure === h) cell.classList.add("choisi");
          cell.addEventListener("click", () => onCreneau(j, h, cell));
        }
        grille.appendChild(cell);
      });
    });
    return el("div", { class: "carte carte-corps" }, [
      el("h3", { class: "mb-2", text: "Créneaux de la semaine" }),
      el("p", { class: "texte-sm texte-faible mb-4", text: "Cliquez sur un créneau libre pour réserver." }),
      el("div", { class: "calendrier" }, [grille]),
    ]);
  }

  /* ======================= FLUX DE RÉSERVATION ===================== */
  function ouvrirReservation(coach, jourPre, heurePre, tarifPre) {
    if (!auth.estConnecte()) { CL.toast.info("Connexion requise", "Connectez-vous pour réserver."); location.hash = "#/connexion"; return; }
    const u = auth.courant();
    if (u.role === "coach") { CL.toast.info("Compte coach", "Utilisez un compte client pour réserver."); return; }

    const choix = { tarifId: tarifPre || (coach.tarifs[0] && coach.tarifs[0].id), jour: jourPre || null, heure: heurePre || null };

    const selTarif = el("select", { class: "select" }, coach.tarifs.map((t) => el("option", { value: t.id, text: `${t.nom} — ${format.fcfa(t.prix)}` })));
    selTarif.value = choix.tarifId;
    selTarif.addEventListener("change", () => { choix.tarifId = selTarif.value; majRecap(); });

    const infoCreneau = el("div", { class: "carte carte-corps", style: "background:var(--surface-2)" });
    const cal = calendrierDispo(coach, (j, h, cell) => {
      choix.jour = j; choix.heure = h;
      contenu.querySelectorAll(".creneau.choisi").forEach((c) => c.classList.remove("choisi"));
      cell.classList.add("choisi");
      majRecap();
    });

    const message = el("textarea", { class: "textarea", placeholder: "Un message pour le coach (objectif, niveau…) — facultatif", rows: "2" });

    function tarif() { return coach.tarifs.find((t) => t.id === choix.tarifId); }
    function majRecap() {
      const t = tarif();
      CL.dom.vider(infoCreneau);
      infoCreneau.appendChild(el("div", { class: "pile-2" }, [
        el("div", { class: "recap-ligne" }, [el("span", { text: "Prestation" }), el("strong", { text: t.nom })]),
        el("div", { class: "recap-ligne" }, [el("span", { text: "Durée" }), el("span", { text: t.duree + " min" })]),
        el("div", { class: "recap-ligne" }, [el("span", { text: "Créneau" }), el("strong", { text: choix.jour ? choix.jour + " à " + choix.heure : "À choisir" })]),
        el("div", { class: "recap-total mt-2" }, [el("span", { text: "Total" }), el("span", { text: format.fcfa(t.prix) })]),
      ]));
    }
    majRecap();

    const contenu = el("div", { class: "pile-4" }, [
      el("div", { class: "champ" }, [el("label", { text: "Prestation" }), selTarif]),
      cal,
      el("div", { class: "champ" }, [el("label", { text: "Message (facultatif)" }), message]),
      infoCreneau,
    ]);

    CL.modal.ouvrir({
      titre: "Réserver avec " + nomCoach(coach),
      large: true,
      contenu,
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", html: CL.icon("portefeuille", 18) + " Continuer vers le paiement", onclick: () => {
          if (!choix.jour || !choix.heure) return CL.toast.erreur("Créneau manquant", "Choisissez un créneau libre.");
          const t = tarif();
          const resa = bookingService.creer({
            coachId: coach.id, clientId: u.id, clientNom: u.prenom + " " + u.nom,
            tarifId: t.id, tarifNom: t.nom, prix: t.prix, duree: t.duree,
            jour: choix.jour, heure: choix.heure, message: message.value.trim(),
          });
          CL.modal.fermer();
          ouvrirPaiement(coach, resa);
        } }),
      ],
    });
  }

  /* ========================== PAIEMENT ============================= */
  function ouvrirPaiement(coach, resa) {
    let operateur = "orange";
    let promoActif = null; // { code, taux, libelle }
    const numero = el("input", { class: "input", type: "tel", placeholder: "Numéro Mobile Money (ex: 07 01 02 03 04)" });
    const code = el("input", { class: "input", type: "text", inputmode: "numeric", maxlength: "4", placeholder: "Code de confirmation (4 chiffres)" });

    const grilleOp = el("div", { class: "operateurs" }, bookingService.OPERATEURS.map((op, i) => {
      const carte = el("div", { class: "operateur-carte" + (i === 0 ? " actif" : ""), "data-op": op.id }, [
        el("div", { class: "operateur-carte__logo " + op.classe, text: op.label }),
        el("div", { class: "texte-xs gras", text: op.nom }),
      ]);
      carte.addEventListener("click", () => {
        grilleOp.querySelectorAll(".operateur-carte").forEach((c) => c.classList.remove("actif"));
        carte.classList.add("actif");
        operateur = op.id;
      });
      return carte;
    }));

    // --- Récapitulatif dynamique (avec remise éventuelle) ---
    const recap = el("div", { class: "carte carte-corps", style: "background:var(--bleu-confiance-clair)" });
    function montantFinal() { return promoActif ? resa.prix - Math.round((resa.prix * promoActif.taux) / 100) : resa.prix; }
    function majRecapPaiement() {
      CL.dom.vider(recap);
      recap.appendChild(el("div", { class: "recap-ligne" }, [el("span", { text: resa.tarifNom }), el("span", { text: format.fcfa(resa.prix) })]));
      if (promoActif) {
        const remise = Math.round((resa.prix * promoActif.taux) / 100);
        recap.appendChild(el("div", { class: "recap-ligne", style: "color:var(--vert-validation)" }, [
          el("span", { text: "Remise " + promoActif.libelle + " (-" + promoActif.taux + "%)" }),
          el("strong", { text: "-" + format.fcfa(remise) }),
        ]));
      }
      recap.appendChild(el("div", { class: "recap-total mt-2" }, [el("span", { text: "À payer" }), el("strong", { text: format.fcfa(montantFinal()) })]));
      recap.appendChild(el("div", { class: "texte-sm texte-doux mt-2", text: nomCoach(coach) + " · " + resa.jour + " à " + resa.heure }));
      btnPayer.innerHTML = CL.icon("check", 18) + " Payer " + format.fcfa(montantFinal());
    }

    // --- Champ code promo ---
    const promoInput = el("input", { class: "input", placeholder: "Code promo ou parrainage", style: "text-transform:uppercase" });
    const promoMsg = el("div", { class: "aide" });
    const btnPromo = el("button", { class: "btn btn-doux", text: "Appliquer" });
    btnPromo.addEventListener("click", () => {
      const res = bookingService.validerPromo(promoInput.value, CL.auth.courant().id);
      if (!res.ok) {
        promoActif = null;
        promoMsg.textContent = res.message;
        promoMsg.style.color = "var(--rouge-alerte)";
      } else {
        promoActif = { code: promoInput.value.trim().toUpperCase(), taux: res.taux, libelle: res.libelle };
        promoMsg.textContent = "✓ " + res.libelle + " : -" + res.taux + "% appliqué !";
        promoMsg.style.color = "var(--vert-validation)";
        CL.toast.succes("Code appliqué 🎁", res.libelle + " -" + res.taux + "%");
      }
      majRecapPaiement();
    });

    const btnPayer = el("button", { class: "btn btn-succes" });

    const contenu = el("div", { class: "pile-4" }, [
      recap,
      el("div", {}, [el("label", { class: "champ", style: "display:block;font-weight:600;margin-bottom:8px", text: "Choisissez votre opérateur" }), grilleOp]),
      el("div", { class: "champ" }, [el("label", { text: "Numéro Mobile Money" }), numero]),
      el("div", { class: "champ" }, [el("label", { text: "Code de confirmation" }), code, el("div", { class: "aide", text: "Simulation : saisissez n'importe quel code à 4 chiffres (ex: 1234)." })]),
      el("div", { class: "champ" }, [
        el("label", { html: CL.icon("eclair", 15) + " Code promo / parrainage" }),
        el("div", { class: "rangee gap-2" }, [promoInput, btnPromo]),
        promoMsg,
        el("div", { class: "aide", text: "Essayez : BIENVENUE10, COACHLINK15 ou SPORT2026." }),
      ]),
      el("div", { class: "rangee gap-2 texte-xs texte-faible", html: CL.icon("bouclier", 16) + " Paiement simulé & sécurisé. Aucune transaction réelle." }),
    ]);
    majRecapPaiement();

    btnPayer.addEventListener("click", () => {
      const op = bookingService.OPERATEURS.find((o) => o.id === operateur);
      if (op.prefixe && !CL.validation.telephoneCI(numero.value)) return CL.toast.erreur("Numéro invalide", "Format CI attendu (07/05/01).");
      const res = bookingService.payer(resa.id, { operateur: op.nom, numero: numero.value.trim(), code: code.value.trim(), promo: promoActif });
      if (!res.ok) return CL.toast.erreur("Paiement refusé", res.message);
      CL.modal.fermer();
      const eco = res.reservation.paiement.remise ? " (économie : " + format.fcfa(res.reservation.paiement.remise) + ")" : "";
      CL.toast.succes("Paiement réussi 🎉", "Réf : " + res.reservation.paiement.reference + eco);
      location.hash = "#/client/reservations";
    });

    CL.modal.ouvrir({
      titre: "Paiement Mobile Money",
      contenu,
      pied: [
        el("button", { class: "btn btn-fantome", text: "Plus tard", onclick: () => { CL.modal.fermer(); CL.toast.info("Réservation en attente", "Vous pourrez payer depuis vos réservations."); location.hash = "#/client/reservations"; } }),
        btnPayer,
      ],
    });
  }

  /* ========================== AVIS ================================ */
  function ouvrirAvis(coach, resa) {
    const saisie = ui.etoilesSaisie(5);
    const texte = el("textarea", { class: "textarea", placeholder: "Partagez votre expérience avec ce coach…" });
    CL.modal.ouvrir({
      titre: "Évaluer " + nomCoach(coach),
      contenu: el("div", { class: "pile-4" }, [
        el("div", { class: "texte-centre" }, [el("p", { class: "mb-2", text: "Quelle note donnez-vous ?" }), saisie.element]),
        el("div", { class: "champ" }, [el("label", { text: "Votre commentaire" }), texte]),
      ]),
      pied: [
        el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
        el("button", { class: "btn btn-cta", text: "Publier l'avis", onclick: () => {
          if (!texte.value.trim()) return CL.toast.erreur("Commentaire requis", "Écrivez quelques mots.");
          const u = auth.courant();
          coachService.ajouterAvis(coach.id, { auteur: u.prenom + " " + u.nom, note: saisie.valeur(), texte: texte.value.trim() });
          if (resa) bookingService.marquerAvisLaisse(resa.id);
          CL.modal.fermer();
          CL.toast.succes("Merci !", "Votre avis a été publié.");
          CL.router.rendre();
        } }),
      ],
    });
  }
  CL.ouvrirAvis = ouvrirAvis; // réutilisé par l'espace client

  /* ========================== CONTACT ============================= */
  function contacter(coach) {
    if (!auth.estConnecte()) { CL.toast.info("Connexion requise", ""); location.hash = "#/connexion"; return; }
    const u = auth.courant();
    const cible = coach.proprietaire || ("coach:" + coach.id); // id destinataire (démo)
    const conv = CL.messageService.ouvrir({ userId: u.id, userNom: u.prenom + " " + u.nom, autreId: cible, autreNom: nomCoach(coach) });
    CL.messageService.envoyer(conv.id, u.id, "Bonjour " + coach.prenom + ", je suis intéressé(e) par votre accompagnement.");
    CL.toast.succes("Message envoyé", "Poursuivez la conversation dans la messagerie.");
    location.hash = "#/messages";
  }

  /* ========================== PARTAGE ============================= */
  function cartePartage(coach) {
    const url = CL.socialService.lienProfil(coach.id);
    return el("div", { class: "carte carte-corps" }, [
      el("h4", { class: "mb-2", html: CL.icon("partager", 18) + " Partager ce profil" }),
      el("p", { class: "texte-sm texte-faible mb-3", text: "Aidez ce coach à se faire connaître." }),
      ui.boutonsPartage(url, "Découvrez " + nomCoach(coach) + " sur CoachLink CI"),
    ]);
  }

  function ouvrirPartage(coach) {
    const url = CL.socialService.lienProfil(coach.id);
    const champLien = el("input", { class: "input", value: url, readonly: "readonly" });
    CL.modal.ouvrir({
      titre: "Partager le profil de " + nomCoach(coach),
      contenu: el("div", { class: "pile-4" }, [
        el("div", { class: "carte carte-corps rangee gap-3", style: "background:var(--surface-2)" }, [
          ui.avatarCoach(coach, "avatar-md"),
          el("div", {}, [el("strong", { text: nomCoach(coach) }), el("div", { class: "texte-sm texte-doux", text: coach.titre }), el("div", { class: "badge badge-verifie mt-2", html: CL.icon("verifie", 12, { fill: true }) + " Aperçu du partage (Open Graph)" })]),
        ]),
        el("div", { class: "champ" }, [el("label", { text: "Lien du profil" }), el("div", { class: "rangee gap-2" }, [champLien, el("button", { class: "btn btn-primaire", text: "Copier", onclick: async () => { (await CL.socialService.copier(url)) ? CL.toast.succes("Copié", "") : CL.toast.erreur("Échec", ""); } })])]),
        el("div", {}, [el("label", { class: "champ", style: "display:block;font-weight:600;margin-bottom:8px", text: "Partager sur les réseaux" }), ui.boutonsPartage(url, "Découvrez " + nomCoach(coach) + " sur CoachLink CI")]),
      ]),
    });
  }

  /* --------------------------- Helpers ---------------------------- */
  function nomCoach(c) { return coachService.nomComplet(c); }
  function stat(valeur, label) { return el("div", { class: "profil-stat" }, [el("strong", { text: String(valeur) }), el("span", { text: label })]); }
  function jaugeTrust(score) {
    const j = el("div", { class: "trustscore__jauge", style: "--p:" + score }, [el("span", { text: score })]);
    return j;
  }

  // Exposé pour réutilisation (espace coach : calendrier, diplômes).
  CL.profilComposants = { calendrierDispo, cartesDiplomes, cartePost, avisItem };
})();

/* ==========================================================================
   pages/coach.js — Espace coach : tableau de bord (stats + graphique),
   demandes de réservation, édition du profil, mur, disponibilités, diplômes,
   réponses aux avis.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, esc } = CL.dom;
  const { auth, coachService, bookingService, ui, format } = CL;

  function moncoach() { return CL.coachCourant(); }
  function garde() {
    const c = moncoach();
    if (!c) return ui.vide("utilisateur", "Profil coach introuvable", "Votre fiche coach n'a pas été trouvée.");
    return null;
  }

  /* -------------------------- Tableau de bord ---------------------- */
  CL.pages.coachAccueil = function () {
    const err = garde(); if (err) return err;
    const u = auth.courant();
    const c = moncoach();
    const demandes = bookingService.parCoach(c.id);
    const enAttente = demandes.filter((r) => r.statut === "en_attente").length;
    const confirmees = demandes.filter((r) => r.statut === "confirmee").length;
    const revenus = demandes.filter((r) => r.paiement).reduce((s, r) => s + r.prix, 0);
    const trust = coachService.trustScore(c);

    const page = el("div", {}, [
      CL.enteteBienvenue(u, "Pilotez votre activité de coaching."),
      el("div", { class: "grille grille-4 mb-5" }, [
        CL.statCarte("horloge", "var(--orange-cta)", enAttente, "Demandes en attente"),
        CL.statCarte("calendrier", "var(--bleu-confiance)", confirmees, "Séances confirmées"),
        CL.statCarte("etoile", "var(--jaune-etoile)", format.note(c.note), "Note moyenne"),
        CL.statCarte("portefeuille", "var(--vert-validation)", format.fcfa(revenus).replace(" FCFA", ""), "Revenus (FCFA)"),
      ]),
    ]);

    // TrustScore + graphique
    page.appendChild(el("div", { class: "deux-colonnes" }, [
      el("div", { class: "carte carte-corps" }, [
        el("div", { class: "rangee entre mb-3" }, [el("h3", { text: "Séances des 6 derniers mois" }), el("span", { class: "badge badge-verifie", text: "Simulation" })]),
        graphiqueBarres(),
      ]),
      el("div", { class: "carte carte-corps" }, [
        el("h4", { class: "mb-3", text: "Votre TrustScore" }),
        el("div", { class: "texte-centre" }, [
          el("div", { class: "trustscore__jauge", style: "--p:" + trust + ";width:120px;height:120px;margin:0 auto" }, [el("span", { style: "width:96px;height:96px;font-size:var(--fs-2xl)", text: trust })]),
          el("p", { class: "texte-sm mt-3", text: "Améliorez-le en faisant vérifier vos diplômes et en répondant vite." }),
        ]),
        ui.badges(c),
      ]),
    ]));

    page.appendChild(el("div", { class: "rangee entre mt-5 mb-3" }, [el("h3", { text: "Dernières demandes" }), el("a", { class: "btn-lien", href: "#/espace-coach/reservations", text: "Tout voir" })]));
    const recentes = demandes.slice(0, 3);
    page.appendChild(recentes.length ? el("div", { class: "pile-3" }, recentes.map((r) => CL.carteReservation(r, "coach"))) : ui.vide("inbox", "Aucune demande", "Les demandes de vos clients apparaîtront ici."));
    return page;
  };

  /* ---------------------------- Demandes -------------------------- */
  CL.pages.coachReservations = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();
    const liste = el("div", { class: "pile-3" });
    let filtre = "toutes";

    function rendre() {
      let resas = bookingService.parCoach(c.id);
      if (filtre !== "toutes") resas = resas.filter((r) => r.statut === filtre);
      CL.dom.vider(liste);
      if (!resas.length) { liste.appendChild(ui.vide("inbox", "Aucune demande", "")); return; }
      resas.forEach((r) => liste.appendChild(carteDemandeCoach(r, rendre)));
    }

    const filtres = el("div", { class: "onglets mb-4" }, [
      ["toutes", "Toutes"], ["en_attente", "En attente"], ["confirmee", "Confirmées"], ["terminee", "Terminées"],
    ].map(([cle, label], i) => {
      const o = el("button", { class: "onglet" + (i === 0 ? " actif" : ""), text: label });
      o.addEventListener("click", () => { filtre = cle; filtres.querySelectorAll(".onglet").forEach((x) => x.classList.remove("actif")); o.classList.add("actif"); rendre(); });
      return o;
    }));

    rendre();
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Demandes de réservation" }), el("p", { text: "Acceptez, refusez et suivez vos séances." })])]), filtres, liste]);
  };

  function carteDemandeCoach(r, onChange) {
    const st = bookingService.STATUTS[r.statut];
    const actions = el("div", { class: "rangee gap-2 rangee-wrap" });
    if (r.statut === "en_attente") {
      actions.appendChild(el("button", { class: "btn btn-succes btn-sm", html: CL.icon("check", 16) + " Accepter", onclick: () => { bookingService.changerStatut(r.id, "confirmee"); CL.toast.succes("Confirmée", "Le client a été notifié."); onChange(); } }));
      actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", text: "Refuser", onclick: () => { bookingService.changerStatut(r.id, "refusee"); CL.toast.info("Refusée", ""); onChange(); } }));
    } else if (r.statut === "confirmee") {
      actions.appendChild(el("button", { class: "btn btn-primaire btn-sm", html: CL.icon("check", 16) + " Marquer terminée", onclick: () => { bookingService.changerStatut(r.id, "terminee"); CL.toast.succes("Séance terminée", "Le client pourra laisser un avis."); onChange(); } }));
    }
    actions.appendChild(el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("message", 16) + " Message", onclick: () => contacterClient(r) }));

    return el("div", { class: "carte carte-corps" }, [
      el("div", { class: "rangee entre rangee-wrap gap-3" }, [
        el("div", { class: "rangee gap-3" }, [
          ui.avatarNom(r.clientNom, "avatar-md", "#475569"),
          el("div", {}, [
            el("strong", { text: r.clientNom }),
            el("div", { class: "texte-sm texte-doux", text: r.tarifNom + " · " + format.fcfa(r.prix) }),
            el("div", { class: "texte-xs texte-faible", html: CL.icon("calendrier", 13) + " " + r.jour + " à " + r.heure }),
            r.message ? el("p", { class: "texte-sm mt-2", style: "background:var(--surface-2);padding:8px 12px;border-radius:8px", text: "« " + r.message + " »" }) : null,
          ]),
        ]),
        el("span", { class: "pastille-statut " + st.classe, text: st.label }),
      ]),
      el("div", { class: "mt-3", style: "border-top:1px solid var(--bordure);padding-top:12px" }, [actions]),
    ]);
  }

  function contacterClient(r) {
    const u = auth.courant();
    const conv = CL.messageService.ouvrir({ userId: u.id, userNom: u.prenom + " " + u.nom, autreId: r.clientId, autreNom: r.clientNom });
    location.hash = "#/messages?conv=" + conv.id;
  }

  /* ----------------------------- Profil --------------------------- */
  CL.pages.coachProfil = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();

    const titre = el("input", { class: "input", value: c.titre });
    const bio = el("textarea", { class: "textarea", rows: "5", text: c.bio });
    const commune = el("select", { class: "select" }, coachService.communes().map((x) => el("option", { value: x, text: x, selected: x === c.commune ? "selected" : null })));

    // Spécialités multi-tags
    const speSelectionnees = new Set(c.specialites);
    const chips = el("div", { class: "filtre-chips" }, coachService.specialites().map((s) => {
      const ch = el("button", { class: "chip" + (speSelectionnees.has(s.id) ? " actif" : ""), text: s.emoji + " " + s.nom });
      ch.addEventListener("click", () => { speSelectionnees.has(s.id) ? speSelectionnees.delete(s.id) : speSelectionnees.add(s.id); ch.classList.toggle("actif"); });
      return ch;
    }));

    // Tarifs éditables
    const tarifs = JSON.parse(JSON.stringify(c.tarifs || []));
    const zoneTarifs = el("div", { class: "pile-3" });
    function rendreTarifs() {
      CL.dom.vider(zoneTarifs);
      tarifs.forEach((t, i) => {
        zoneTarifs.appendChild(el("div", { class: "carte carte-corps" }, [
          el("div", { class: "grille grille-2" }, [
            champ("Nom", inp(t.nom, (v) => t.nom = v)),
            champ("Type", selType(t.type, (v) => t.type = v)),
          ]),
          el("div", { class: "grille grille-2" }, [
            champ("Prix (FCFA)", inp(t.prix, (v) => t.prix = Number(v) || 0, "number")),
            champ("Durée (min)", inp(t.duree, (v) => t.duree = Number(v) || 0, "number")),
          ]),
          champ("Description", inp(t.description, (v) => t.description = v)),
          el("button", { class: "btn btn-fantome btn-sm", html: CL.icon("poubelle", 14) + " Supprimer", onclick: () => { tarifs.splice(i, 1); rendreTarifs(); } }),
        ]));
      });
    }
    rendreTarifs();

    const page = el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mon profil coach" }), el("p", { text: "Ces informations sont visibles publiquement." })]), el("a", { class: "btn btn-fantome", href: "#/coach/" + c.id, html: CL.icon("oeil", 18) + " Voir mon profil public" })]),
      el("div", { class: "carte carte-corps rangee gap-4 mb-4" }, [
        ui.avatarCoach(c, "avatar-lg"),
        el("div", {}, [el("strong", { style: "font-size:var(--fs-lg)", text: coachService.nomComplet(c) }), el("p", { class: "texte-sm texte-doux", text: "Photo générée automatiquement (upload simulé)." }), el("button", { class: "btn btn-fantome btn-sm mt-2", html: CL.icon("crayon", 14) + " Changer la photo", onclick: () => CL.toast.info("Simulation", "L'upload de photo sera géré par l'API.") })]),
      ]),
      el("div", { class: "carte carte-corps pile-4 mb-4" }, [
        champ("Titre / accroche", titre),
        champ("Biographie", bio),
        champ("Commune", commune),
        el("div", {}, [el("label", { class: "champ", style: "display:block;font-weight:600;margin-bottom:8px", text: "Spécialités" }), chips]),
      ]),
      el("div", { class: "rangee entre mb-3" }, [el("h3", { text: "Tarifs & prestations" }), el("button", { class: "btn btn-doux btn-sm", html: CL.icon("plus", 16) + " Ajouter", onclick: () => { tarifs.push({ id: CL.dom.uid("t"), nom: "Nouvelle prestation", type: "seance", prix: 10000, duree: 60, description: "" }); rendreTarifs(); } })]),
      zoneTarifs,
      el("div", { class: "rangee mt-5" }, [el("button", { class: "btn btn-cta btn-lg", html: CL.icon("check", 18) + " Enregistrer les modifications", onclick: enregistrer })]),
    ]);

    function enregistrer() {
      if (speSelectionnees.size === 0) return CL.toast.erreur("Spécialité requise", "Choisissez au moins une spécialité.");
      coachService.majProfil(c.id, {
        titre: titre.value.trim(), bio: bio.value.trim(), commune: commune.value,
        specialites: Array.from(speSelectionnees), tarifs,
        categorie: (coachService.specialites().find((s) => s.id === Array.from(speSelectionnees)[0]) || {}).categorie || c.categorie,
      });
      CL.toast.succes("Profil mis à jour", "Vos modifications sont enregistrées.");
      CL.router.rendre();
    }
    return page;

    function inp(val, onInput, type) { const i = el("input", { class: "input", type: type || "text", value: val }); i.addEventListener("input", () => onInput(i.value)); return i; }
    function selType(val, onChange) { const s = el("select", { class: "select" }, [["seance", "Séance"], ["pack", "Pack"], ["abonnement", "Abonnement"]].map(([v, l]) => el("option", { value: v, text: l, selected: v === val ? "selected" : null }))); s.addEventListener("change", () => onChange(s.value)); return s; }
  };

  /* ------------------------------- Mur ---------------------------- */
  CL.pages.coachMur = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();
    const zone = el("div", { class: "pile-4" });
    const texte = el("textarea", { class: "textarea", placeholder: "Partagez une réussite, une astuce, une annonce…", rows: "3" });

    function rendreMur() {
      CL.dom.vider(zone);
      const posts = coachService.obtenir(c.id).posts || [];
      if (!posts.length) { zone.appendChild(ui.vide("document", "Aucune publication", "Publiez votre premier post pour animer votre mur.")); return; }
      posts.forEach((p) => zone.appendChild(el("div", {}, [CL.profilComposants.cartePost(c, p)])));
    }
    rendreMur();

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mon mur" }), el("p", { text: "Publiez pour engager votre communauté." })])]),
      el("div", { class: "carte carte-corps mb-4" }, [
        el("div", { class: "rangee gap-3", style: "align-items:flex-start" }, [ui.avatarCoach(c, "avatar-sm"), el("div", { style: "flex:1" }, [texte])]),
        el("div", { class: "rangee entre mt-3" }, [
          el("span", { class: "texte-xs texte-faible", html: CL.icon("trombone", 14) + " Photo/vidéo (lien) — bientôt via l'API" }),
          el("button", { class: "btn btn-cta", html: CL.icon("envoyer", 16) + " Publier", onclick: () => {
            if (!texte.value.trim()) return CL.toast.erreur("Vide", "Écrivez quelque chose.");
            coachService.ajouterPost(c.id, { texte: texte.value.trim() });
            texte.value = ""; CL.toast.succes("Publié", ""); rendreMur();
          } }),
        ]),
      ]),
      zone,
    ]);
  };

  /* -------------------------- Disponibilités ---------------------- */
  CL.pages.coachDispo = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();
    const heures = ["08:00", "09:00", "10:00", "11:00", "16:00", "17:00", "18:00", "19:00"];
    const dispo = JSON.parse(JSON.stringify(c.disponibilites));
    format.JOURS_COURTS.forEach((j) => { if (!dispo[j]) dispo[j] = []; });

    const grille = el("div", { class: "calendrier__grille" });
    function rendreGrille() {
      CL.dom.vider(grille);
      grille.appendChild(el("div", { class: "calendrier__entete" }));
      format.JOURS_COURTS.forEach((j) => grille.appendChild(el("div", { class: "calendrier__entete", text: j })));
      heures.forEach((h) => {
        grille.appendChild(el("div", { class: "calendrier__heure", text: h }));
        format.JOURS_COURTS.forEach((j) => {
          const libre = dispo[j].includes(h);
          const cell = el("div", { class: "creneau " + (libre ? "libre choisi" : "occupe"), text: libre ? "Libre" : "Fermé" });
          cell.style.cursor = "pointer";
          cell.addEventListener("click", () => {
            if (dispo[j].includes(h)) dispo[j] = dispo[j].filter((x) => x !== h);
            else dispo[j].push(h);
            rendreGrille();
          });
          grille.appendChild(cell);
        });
      });
    }
    rendreGrille();

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes disponibilités" }), el("p", { text: "Cliquez pour ouvrir/fermer vos créneaux hebdomadaires." })])]),
      el("div", { class: "carte carte-corps" }, [el("div", { class: "calendrier" }, [grille])]),
      el("div", { class: "rangee mt-4" }, [el("button", { class: "btn btn-cta btn-lg", html: CL.icon("check", 18) + " Enregistrer", onclick: () => { coachService.majDisponibilites(c.id, dispo); CL.toast.succes("Disponibilités mises à jour", ""); } })]),
    ]);
  };

  /* ----------------------------- Diplômes ------------------------- */
  CL.pages.coachDiplomes = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();
    const zone = el("div", {});
    function rendreListe() { CL.dom.vider(zone); zone.appendChild(CL.profilComposants.cartesDiplomes(coachService.obtenir(c.id))); }
    rendreListe();

    function ouvrirAjout() {
      const t = el("input", { class: "input", placeholder: "Ex : Licence STAPS" });
      const e = el("input", { class: "input", placeholder: "Établissement" });
      const a = el("input", { class: "input", type: "number", placeholder: "Année", min: "1980", max: "2026" });
      CL.modal.ouvrir({
        titre: "Ajouter un diplôme",
        contenu: el("div", { class: "pile-4" }, [
          champ("Intitulé", t), champ("École / organisme", e), champ("Année d'obtention", a),
          el("div", { class: "carte carte-corps texte-centre", style: "border:2px dashed var(--bordure-forte);cursor:pointer", html: CL.icon("diplome", 32) + '<div class="texte-sm texte-faible mt-2">Glissez un fichier PDF/image ici (upload simulé)</div>' }),
        ]),
        pied: [
          el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
          el("button", { class: "btn btn-cta", text: "Soumettre pour vérification", onclick: () => {
            if (!t.value.trim() || !e.value.trim()) return CL.toast.erreur("Champs requis", "Complétez l'intitulé et l'école.");
            coachService.ajouterDiplome(c.id, { titre: t.value.trim(), ecole: e.value.trim(), annee: Number(a.value) || 2024 });
            CL.modal.fermer(); CL.toast.succes("Diplôme soumis", "Il sera vérifié par un administrateur."); rendreListe();
          } }),
        ],
      });
    }

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Mes diplômes" }), el("p", { text: "Faites vérifier vos qualifications pour obtenir le badge de confiance." })]), el("button", { class: "btn btn-cta", html: CL.icon("plus", 18) + " Ajouter un diplôme", onclick: ouvrirAjout })]),
      el("div", { class: "carte carte-corps mb-4", style: "background:var(--bleu-confiance-clair)" }, [el("div", { class: "rangee gap-2 texte-sm", html: CL.icon("bouclier", 18) + " Les diplômes vérifiés augmentent fortement votre TrustScore et rassurent les clients." })]),
      zone,
    ]);
  };

  /* ------------------------------- Avis --------------------------- */
  CL.pages.coachAvis = function () {
    const err = garde(); if (err) return err;
    const c = moncoach();
    const zone = el("div", { class: "carte carte-corps" });
    function rendreAvis() {
      CL.dom.vider(zone);
      const avis = coachService.obtenir(c.id).avis || [];
      if (!avis.length) { zone.appendChild(ui.vide("etoile", "Aucun avis", "Vos avis clients apparaîtront ici.")); return; }
      avis.forEach((a) => {
        const item = el("div", { class: "avis-item" }, [
          el("div", { class: "rangee entre" }, [
            el("div", { class: "rangee gap-2" }, [ui.avatarNom(a.auteur, "avatar-sm", "#475569"), el("div", {}, [el("strong", { text: a.auteur }), el("div", { class: "texte-xs texte-faible", text: format.date(a.date) })])]),
            ui.etoiles(a.note),
          ]),
          el("p", { class: "mt-2", style: "color:var(--texte)", text: a.texte }),
        ]);
        if (a.reponse) {
          item.appendChild(el("div", { class: "avis-reponse" }, [el("strong", { class: "texte-sm", text: "Votre réponse" }), el("p", { class: "texte-sm mt-2", text: a.reponse })]));
        } else {
          const rep = el("textarea", { class: "textarea", placeholder: "Répondre à cet avis…", rows: "2" });
          item.appendChild(el("div", { class: "mt-3" }, [rep, el("button", { class: "btn btn-primaire btn-sm mt-2", text: "Publier la réponse", onclick: () => {
            if (!rep.value.trim()) return CL.toast.erreur("Vide", "Écrivez une réponse.");
            coachService.repondreAvis(c.id, a.id, rep.value.trim());
            CL.toast.succes("Réponse publiée", ""); rendreAvis();
          } })]));
        }
        zone.appendChild(item);
      });
    }
    rendreAvis();
    return el("div", {}, [el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Avis reçus" }), el("p", { text: "Répondez pour montrer votre professionnalisme." })])]), zone]);
  };

  /* --------------------------- Composants ------------------------- */
  function graphiqueBarres() {
    const donnees = [8, 12, 10, 16, 14, 20];
    const mois = ["Fév", "Mar", "Avr", "Mai", "Jun", "Jui"];
    const max = Math.max(...donnees);
    return el("div", { class: "bar-chart" }, donnees.map((v, i) => el("div", { class: "bar-chart__col" }, [
      el("strong", { class: "texte-sm", text: String(v) }),
      el("div", { class: "bar-chart__barre", style: `height:${(v / max) * 100}%` }),
      el("div", { class: "bar-chart__label", text: mois[i] }),
    ])));
  }

  function champ(label, input) { return el("div", { class: "champ" }, [el("label", { text: label }), input]); }
})();

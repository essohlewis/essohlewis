/* ==========================================================================
   pages/settings.js — Paramètres : profil, thème, langue, notifications,
   confidentialité, réinitialisation des données de démonstration.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { auth, validation, storage } = CL;

  CL.pages.parametres = function () {
    const u = auth.courant();

    /* ------------------------- Profil ---------------------------- */
    const prenom = el("input", { class: "input", value: u.prenom });
    const nom = el("input", { class: "input", value: u.nom });
    const email = el("input", { class: "input", type: "email", value: u.email });
    const tel = el("input", { class: "input", type: "tel", value: u.telephone });

    const carteProfil = el("div", { class: "carte carte-corps pile-4" }, [
      el("h3", { text: "Informations personnelles" }),
      el("div", { class: "grille grille-2" }, [champ("Prénom", prenom), champ("Nom", nom)]),
      champ("Email", email),
      champ("Téléphone", tel),
      el("button", { class: "btn btn-cta", html: CL.icon("check", 18) + " Enregistrer", onclick: () => {
        if (!validation.requis(prenom.value) || !validation.requis(nom.value)) return CL.toast.erreur("Champs requis", "Prénom et nom obligatoires.");
        if (!validation.email(email.value)) return CL.toast.erreur("Email invalide", "");
        if (tel.value && !validation.telephoneCI(tel.value)) return CL.toast.erreur("Téléphone invalide", "Format CI attendu.");
        auth.majUtilisateur({ prenom: prenom.value.trim(), nom: nom.value.trim(), email: email.value.trim(), telephone: tel.value.trim() });
        CL.toast.succes("Enregistré", "Profil mis à jour.");
        CL.layout.rendreEntete();
      } }),
    ]);

    /* ----------------------- Préférences ------------------------- */
    const prefs = storage.lire(storage.CLES.prefs, {});
    const toggleTheme = interrupteur("Mode sombre", CL.layout.themeCourant() === "dark", () => CL.layout.basculerTheme());
    const selLangue = el("select", { class: "select" }, CL.i18n.langues.map((l) => el("option", { value: l, text: l === "fr" ? "Français" : l.toUpperCase(), selected: l === CL.i18n.langue() ? "selected" : null })));
    selLangue.addEventListener("change", () => { CL.i18n.definirLangue(selLangue.value); CL.toast.info("Langue", selLangue.value === "fr" ? "Français activé." : "Traduction en cours d'ajout."); });

    const toggleNotifs = interrupteur("Notifications par email", prefs.emailNotifs !== false, (v) => { prefs.emailNotifs = v; storage.ecrire(storage.CLES.prefs, prefs); });

    // Rappels de rendez-vous (J-1 et 2 h avant), activés par défaut.
    const rap = prefs.rappels || {};
    const majRap = () => { prefs.rappels = rap; storage.ecrire(storage.CLES.prefs, prefs); };
    const toggleRapJ1 = interrupteur("Rappel la veille (J-1)", rap.j1 !== false, (v) => { rap.j1 = v; majRap(); });
    const toggleRapH2 = interrupteur("Rappel 2 h avant la séance", rap.h2 !== false, (v) => { rap.h2 = v; majRap(); });

    const cartePref = el("div", { class: "carte carte-corps pile-4" }, [
      el("h3", { text: "Préférences" }),
      toggleTheme,
      el("div", { class: "champ" }, [el("label", { text: "Langue de l'interface" }), selLangue, el("div", { class: "aide", text: "Structure multilingue prête (FR par défaut)." })]),
      toggleNotifs,
      el("div", { class: "champ" }, [el("label", { text: "Rappels de rendez-vous" }), el("div", { class: "aide", text: "Recevez une alerte avant vos séances, consultations et cours." })]),
      toggleRapJ1,
      toggleRapH2,
    ]);

    /* --------------------- Zone dangereuse ----------------------- */
    const carteDanger = el("div", { class: "carte carte-corps pile-3", style: "border-color:var(--rouge-alerte)" }, [
      el("h3", { text: "Zone de démonstration" }),
      el("p", { class: "texte-sm", text: "Réinitialisez toutes les données locales (coachs, comptes, réservations) à leur état d'origine." }),
      el("button", { class: "btn btn-danger", html: CL.icon("poubelle", 18) + " Réinitialiser les données de démo", onclick: () => {
        CL.modal.ouvrir({
          titre: "Confirmer la réinitialisation",
          contenu: el("p", { text: "Toutes les données locales seront effacées et remplacées par le catalogue de démonstration. Vous serez déconnecté. Continuer ?" }),
          pied: [
            el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }),
            el("button", { class: "btn btn-danger", text: "Oui, réinitialiser", onclick: () => { storage.reinitialiser(); auth.deconnecter(); CL.modal.fermer(); CL.toast.succes("Réinitialisé", "Données de démonstration restaurées."); location.hash = "#/"; } }),
          ],
        });
      } }),
      el("button", { class: "btn btn-fantome", html: CL.icon("deconnexion", 18) + " Se déconnecter", onclick: () => { auth.deconnecter(); CL.toast.info("Déconnecté", ""); location.hash = "#/"; CL.layout.rendreEntete(); } }),
    ]);

    /* --------------------- Parrainage ---------------------------- */
    const code = auth.codeParrainage(u);
    const carteParrainage = el("div", { class: "carte carte-corps pile-3", style: "border:1px solid var(--bleu-confiance);background:var(--bleu-confiance-clair)" }, [
      el("h3", { html: CL.icon("eclair", 18, { fill: true }) + " Parrainez & faites des économies" }),
      el("p", { class: "texte-sm", text: "Partagez votre code : vos filleuls bénéficient de -10 % sur leur première séance." }),
      el("div", { class: "rangee gap-2" }, [
        el("input", { class: "input gras", value: code, readonly: "readonly", style: "text-align:center;letter-spacing:1px" }),
        el("button", { class: "btn btn-primaire", html: CL.icon("partager", 16) + " Copier", onclick: async () => {
          (await CL.socialService.copier(code)) ? CL.toast.succes("Code copié", "Partagez-le à vos proches !") : CL.toast.erreur("Échec", "");
        } }),
      ]),
      el("div", {}, [CL.ui.boutonsPartage(location.origin + location.pathname + "#/inscription", "Rejoins-moi sur CoachLink CI avec mon code " + code + " et profite de -10 % !")]),
    ]);

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Paramètres" }), el("p", { text: "Gérez votre compte et vos préférences." })])]),
      el("div", { class: "deux-colonnes--inverse" }, [
        el("div", { class: "pile-4" }, [cartePref, carteDanger]),
        el("div", { class: "pile-4" }, [carteProfil, carteParrainage]),
      ]),
    ]);
  };

  function champ(label, input) { return el("div", { class: "champ" }, [el("label", { text: label }), input]); }

  function interrupteur(label, actif, onToggle) {
    const piste = el("span", { style: `width:44px;height:24px;border-radius:99px;background:${actif ? "var(--bleu-confiance)" : "var(--bordure-forte)"};position:relative;transition:background .2s;flex-shrink:0` }, [
      el("span", { style: `position:absolute;top:2px;left:${actif ? "22px" : "2px"};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s` }),
    ]);
    let etat = actif;
    const ligne = el("label", { class: "rangee entre", style: "cursor:pointer" }, [el("span", { class: "gras texte-sm", text: label }), piste]);
    ligne.addEventListener("click", (e) => {
      e.preventDefault();
      etat = !etat;
      piste.style.background = etat ? "var(--bleu-confiance)" : "var(--bordure-forte)";
      piste.firstChild.style.left = etat ? "22px" : "2px";
      onToggle(etat);
    });
    return ligne;
  }
})();

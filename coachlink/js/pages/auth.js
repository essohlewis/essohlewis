/* ==========================================================================
   pages/auth.js — Connexion & inscription multi-étapes (client / coach),
   connexion sociale simulée, mot de passe oublié, import LinkedIn.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, esc } = CL.dom;
  const { auth, validation, coachService } = CL;

  function redirigerSelonRole(user) {
    if (user.role === "coach") location.hash = "#/espace-coach";
    else if (user.role === "admin") location.hash = "#/admin";
    else location.hash = "#/client";
  }

  /* ============================ CONNEXION ========================== */
  CL.pages.connexion = function () {
    if (auth.estConnecte()) { redirigerSelonRole(auth.courant()); return el("div"); }

    const form = el("div", { class: "auth-carte" }, [
      el("h2", { class: "mb-2", text: "Bon retour 👋" }),
      el("p", { class: "mb-5", text: "Connectez-vous pour accéder à votre espace." }),
      champ("Email", champInput("email", "email", "vous@exemple.ci", "mail")),
      champ("Mot de passe", champInput("motDePasse", "password", "••••••••", "cadenas")),
      el("div", { class: "rangee entre mb-4" }, [
        el("label", { class: "rangee gap-2 texte-sm", style: "cursor:pointer" }, [el("input", { type: "checkbox" }), document.createTextNode(" Se souvenir de moi")]),
        el("button", { class: "btn-lien texte-sm", text: "Mot de passe oublié ?", onclick: motDePasseOublie }),
      ]),
      el("button", { class: "btn btn-primaire btn-bloc btn-lg", text: "Se connecter", onclick: soumettre }),
      el("div", { class: "separateur-texte", text: "ou" }),
      boutonsSociaux(),
      el("p", { class: "texte-centre mt-5 texte-sm" }, [document.createTextNode("Pas encore de compte ? "), el("a", { href: "#/inscription", class: "gras", text: "S'inscrire" })]),
      el("div", { class: "carte mt-4", style: "padding:12px;background:var(--surface-2)" }, [
        el("div", { class: "texte-xs texte-faible", html: "💡 <strong>Démo admin</strong> : admin@coachlink.ci / admin123" }),
      ]),
    ]);

    async function soumettre() {
      const email = form.querySelector('[name="email"]').value.trim();
      const mdp = form.querySelector('[name="motDePasse"]').value;
      if (!validation.email(email)) return CL.toast.erreur("Email invalide", "Vérifiez votre adresse.");
      if (!mdp) return CL.toast.erreur("Champ requis", "Saisissez votre mot de passe.");
      const res = await auth.connecter(email, mdp);
      if (!res.ok) return CL.toast.erreur("Échec", res.message);
      if (CL.hydrate && CL.API && CL.API.actif) await CL.hydrate.donneesUtilisateur();
      CL.toast.succes("Connecté", "Bienvenue " + res.user.prenom + " !");
      redirigerSelonRole(res.user);
    }

    form.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") soumettre(); }));
    return pageAuth("Rejoignez la communauté du coaching de confiance", ["Diplômes vérifiés par notre équipe", "Avis 100 % authentiques", "Paiement sécurisé Mobile Money", "Messagerie directe avec les coachs"], form);
  };

  /* ============================ INSCRIPTION ======================= */
  CL.pages.inscription = function () {
    if (auth.estConnecte()) { redirigerSelonRole(auth.courant()); return el("div"); }

    const etat = { etape: 1, role: null, donnees: {} };
    const zone = el("div", { class: "auth-carte" });

    function rendre() {
      CL.dom.vider(zone);
      zone.appendChild(el("div", { class: "etapes" }, [
        el("div", { class: "etape-point " + (etat.etape >= 1 ? "faite" : "") }),
        el("div", { class: "etape-point " + (etat.etape >= 2 ? "active" : "") }),
      ]));

      if (etat.etape === 1) rendreEtape1();
      else rendreEtape2();
    }

    function rendreEtape1() {
      zone.appendChild(el("h2", { class: "mb-2", text: "Créer un compte" }));
      zone.appendChild(el("p", { class: "mb-5", text: "Qui êtes-vous ? Choisissez votre profil." }));

      const optClient = optionRole("client", "utilisateur", "Je suis un client", "Je cherche un coach pour progresser.");
      const optCoach = optionRole("coach", "diplome", "Je suis un coach", "Je veux proposer mes services et trouver des clients.");
      zone.appendChild(el("div", { class: "pile-3" }, [optClient, optCoach]));

      zone.appendChild(el("button", {
        class: "btn btn-primaire btn-bloc btn-lg mt-5", text: "Continuer",
        onclick: () => { if (!etat.role) return CL.toast.info("Choisissez", "Sélectionnez un profil."); etat.etape = 2; rendre(); },
      }));
      zone.appendChild(el("div", { class: "separateur-texte", text: "ou" }));
      zone.appendChild(boutonsSociaux());
      zone.appendChild(el("p", { class: "texte-centre mt-5 texte-sm" }, [document.createTextNode("Déjà inscrit ? "), el("a", { href: "#/connexion", class: "gras", text: "Se connecter" })]));

      function optionRole(role, icone, titre, desc) {
        const o = el("label", { class: "option-carte" + (etat.role === role ? " actif" : "") }, [
          el("span", { class: "fonctionnalite__icone", style: "width:44px;height:44px;margin:0", html: CL.icon(icone, 22) }),
          el("div", {}, [el("strong", { text: titre }), el("div", { class: "texte-sm texte-doux", text: desc })]),
        ]);
        o.addEventListener("click", () => { etat.role = role; rendre(); });
        return o;
      }
    }

    function rendreEtape2() {
      zone.appendChild(el("button", { class: "btn-lien mb-2", html: CL.icon("fleche_gauche", 16) + " Retour", onclick: () => { etat.etape = 1; rendre(); } }));
      zone.appendChild(el("h2", { class: "mb-2", text: etat.role === "coach" ? "Votre profil coach" : "Vos informations" }));
      zone.appendChild(el("p", { class: "mb-4", text: "Encore une étape et c'est parti !" }));

      if (etat.role === "coach") {
        zone.appendChild(el("button", { class: "btn-social mb-4 social-linkedin", html: CL.icon("linkedin", 18) + " Importer depuis LinkedIn", onclick: importerLinkedIn }));
      }

      const f = el("div", { class: "grille grille-2" }, [
        champ("Prénom", champInput("prenom", "text", "Koffi")),
        champ("Nom", champInput("nom", "text", "Aka")),
      ]);
      zone.appendChild(f);
      zone.appendChild(champ("Email", champInput("email", "email", "vous@exemple.ci", "mail")));
      zone.appendChild(champ("Téléphone (07/05/01)", champInput("telephone", "tel", "07 01 02 03 04", "telephone"), "Numéro Orange (07), MTN (05) ou Moov (01)."));

      if (etat.role === "coach") {
        zone.appendChild(champ("Titre / spécialité", champInput("titre", "text", "Coach sportif & nutrition")));
        const selSpe = el("select", { class: "select", name: "specialite" }, [el("option", { value: "", text: "Choisir une spécialité" }), ...coachService.specialites().map((s) => el("option", { value: s.id, text: s.emoji + " " + s.nom }))]);
        zone.appendChild(champ("Domaine principal", selSpe));
        const selCom = el("select", { class: "select", name: "commune" }, coachService.communes().map((c) => el("option", { value: c, text: c })));
        zone.appendChild(champ("Commune", selCom));
      }

      zone.appendChild(champ("Mot de passe", champInput("motDePasse", "password", "6 caractères minimum", "cadenas")));

      // Pré-remplissage éventuel depuis LinkedIn.
      Object.entries(etat.donnees).forEach(([k, v]) => {
        const inp = zone.querySelector(`[name="${k}"]`);
        if (inp && typeof v === "string") inp.value = v;
      });

      zone.appendChild(el("label", { class: "rangee gap-2 texte-sm mt-2", style: "cursor:pointer" }, [
        el("input", { type: "checkbox", name: "cgu", checked: "checked" }),
        el("span", { html: "J'accepte les <a href='#/comment-ca-marche'>conditions d'utilisation</a>." }),
      ]));

      zone.appendChild(el("button", { class: "btn btn-cta btn-bloc btn-lg mt-4", text: "Créer mon compte", onclick: soumettre }));
    }

    async function importerLinkedIn() {
      CL.toast.info("Import LinkedIn", "Récupération du profil…");
      const donnees = await CL.socialService.importerLinkedIn();
      Object.assign(etat.donnees, donnees);
      rendre();
      CL.toast.succes("Profil importé", "Vérifiez et complétez vos informations.");
    }

    async function soumettre() {
      const val = (n) => { const e = zone.querySelector(`[name="${n}"]`); return e ? e.value.trim() : ""; };
      const donnees = {
        role: etat.role,
        prenom: val("prenom"), nom: val("nom"), email: val("email"),
        telephone: val("telephone"), motDePasse: zone.querySelector('[name="motDePasse"]').value,
      };
      const schema = {
        prenom: [{ test: validation.requis, message: "Prénom requis" }],
        nom: [{ test: validation.requis, message: "Nom requis" }],
        email: [{ test: validation.email, message: "Email invalide" }],
        telephone: [{ test: validation.telephoneCI, message: "Téléphone CI invalide (07/05/01 + 8 chiffres)" }],
        motDePasse: [{ test: validation.motDePasse, message: "6 caractères minimum" }],
      };
      const { valide, erreurs } = validation.valider(donnees, schema);
      if (!valide) {
        const premier = Object.keys(erreurs)[0];
        return CL.toast.erreur("Formulaire incomplet", erreurs[premier]);
      }
      if (etat.role === "coach") {
        donnees.titre = val("titre") || "Nouveau coach";
        donnees.commune = val("commune") || "Cocody";
        const spe = val("specialite");
        donnees.specialites = spe ? [spe] : [];
        donnees.bio = etat.donnees.bio || "";
        donnees.langues = etat.donnees.langues || ["Français"];
      }
      const res = await auth.inscrire(donnees);
      if (!res.ok) return CL.toast.erreur("Échec", res.message);
      if (CL.hydrate && CL.API && CL.API.actif) await CL.hydrate.donneesUtilisateur();
      CL.toast.succes("Compte créé 🎉", "Bienvenue sur CoachLink CI !");
      redirigerSelonRole(res.user);
    }

    rendre();
    return pageAuth("Commencez votre aventure dès aujourd'hui", ["Inscription gratuite en 2 minutes", "Pour les clients comme les coachs", "Vos données restent privées", "Support en français, tarifs en FCFA"], zone);
  };

  /* ---------------------------- Helpers UI -------------------------- */
  function pageAuth(titre, points, formulaire) {
    return el("div", { class: "auth-page" }, [
      el("div", { class: "auth-visuel" }, [
        el("a", { class: "logo mb-5", href: "#/", style: "color:#fff" }, [
          el("span", { class: "logo__pastille", text: "C" }),
          el("span", {}, [document.createTextNode("Coach"), el("span", { style: "color:#ffd9b8", text: "Link" }), document.createTextNode(" CI")]),
        ]),
        el("h2", { text: titre }),
        el("ul", {}, points.map((p) => el("li", {}, [el("span", { html: CL.icon("check", 20) }), document.createTextNode(p)]))),
      ]),
      el("div", { class: "auth-form-zone" }, [formulaire]),
    ]);
  }

  function champ(label, input, aide) {
    return el("div", { class: "champ" }, [
      el("label", { text: label }), input,
      aide ? el("div", { class: "aide", text: aide }) : null,
    ]);
  }

  function champInput(name, type, placeholder, icone) {
    const input = el("input", { class: "input", type, name, placeholder, autocomplete: type === "password" ? "off" : "on" });
    if (icone) return el("div", { class: "input-icone" }, [el("span", { html: CL.icon(icone, 18) }), input]);
    return input;
  }

  function boutonsSociaux() {
    const fb = el("button", { class: "btn-social social-facebook", html: CL.icon("facebook", 18, { fill: true }) + " Facebook" });
    const li = el("button", { class: "btn-social social-linkedin", html: CL.icon("linkedin", 18) + " LinkedIn" });
    fb.addEventListener("click", () => connSociale("facebook"));
    li.addEventListener("click", () => connSociale("linkedin"));
    return el("div", { class: "grille grille-2" }, [fb, li]);
  }

  async function connSociale(reseau) {
    const res = await auth.connexionSociale(reseau);
    if (!res.ok) return CL.toast.info("Indisponible", res.message);
    CL.toast.succes("Connexion " + reseau, "Bienvenue " + res.user.prenom + " !");
    redirigerSelonRole(res.user);
  }

  function motDePasseOublie() {
    const input = el("input", { class: "input", type: "email", placeholder: "vous@exemple.ci" });
    const envoyer = el("button", { class: "btn btn-primaire", text: "Envoyer le lien" });
    envoyer.addEventListener("click", async () => {
      const email = input.value.trim();
      if (!validation.email(email)) return CL.toast.erreur("Email invalide", "Vérifiez votre adresse.");
      envoyer.disabled = true;
      const res = await auth.motDePasseOublie(email);
      envoyer.disabled = false;
      if (!res.ok) return CL.toast.erreur("Échec", res.message);
      if (res.token) { etapeReset(res.token); }          // mode API : lien validé automatiquement (simulation)
      else { CL.modal.fermer(); CL.toast.succes("Envoyé", res.message); }
    });
    CL.modal.ouvrir({
      titre: "Mot de passe oublié",
      contenu: el("div", {}, [
        el("p", { class: "mb-4", text: "Saisissez votre email, nous vous enverrons un lien de réinitialisation." }),
        input,
      ]),
      pied: [el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }), envoyer],
    });

    function etapeReset(token) {
      const npw = el("input", { class: "input", type: "password", placeholder: "Nouveau mot de passe (6 caractères min.)" });
      const valider = el("button", { class: "btn btn-cta", text: "Réinitialiser" });
      valider.addEventListener("click", async () => {
        if ((npw.value || "").length < 6) return CL.toast.erreur("Trop court", "6 caractères minimum.");
        valider.disabled = true;
        const res = await auth.reinitialiser(token, npw.value);
        valider.disabled = false;
        if (!res.ok) return CL.toast.erreur("Échec", res.message);
        CL.modal.fermer();
        CL.toast.succes("Mot de passe modifié", res.message);
      });
      CL.modal.ouvrir({
        titre: "Réinitialiser le mot de passe",
        contenu: el("div", {}, [
          el("div", { class: "carte mb-4", style: "padding:12px;background:var(--surface-2)" }, [
            el("div", { class: "texte-xs texte-faible", html: "💡 <strong>Simulation</strong> : aucun email n'est réellement envoyé ; le lien a été validé automatiquement pour la démo." }),
          ]),
          el("p", { class: "mb-3", text: "Choisissez votre nouveau mot de passe." }),
          npw,
        ]),
        pied: [el("button", { class: "btn btn-fantome", text: "Annuler", onclick: CL.modal.fermer }), valider],
      });
    }
  }
})();
